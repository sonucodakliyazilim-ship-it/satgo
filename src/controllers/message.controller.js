const { query, withTransaction } = require('../config/database');

const getConversations = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { rows } = await query(
      `SELECT conv.*,
              l.title AS listing_title, l.price AS listing_price, l.status AS listing_status,
              (SELECT url FROM listing_images WHERE listing_id = l.id AND is_primary = TRUE LIMIT 1) AS listing_image,
              CASE WHEN conv.buyer_id = $1 THEN u_s.name ELSE u_b.name END AS other_name,
              CASE WHEN conv.buyer_id = $1 THEN u_s.avatar_url ELSE u_b.avatar_url END AS other_avatar,
              CASE WHEN conv.buyer_id = $1 THEN conv.buyer_unread ELSE conv.seller_unread END AS unread_count
       FROM conversations conv
       JOIN listings l ON l.id = conv.listing_id
       JOIN users u_b ON u_b.id = conv.buyer_id
       JOIN users u_s ON u_s.id = conv.seller_id
       WHERE (conv.buyer_id = $1 OR conv.seller_id = $1)
       ORDER BY conv.last_message_at DESC NULLS LAST`,
      [userId],
    );
    res.json({ success: true, data: rows });
  } catch (err) {
    next(err);
  }
};

const getMessages = async (req, res, next) => {
  try {
    const { conversationId } = req.params;
    const userId = req.user.id;
    const { page = 1 } = req.query;
    const perPage = 50;
    const offset = (page - 1) * perPage;

    const conv = await query(
      'SELECT * FROM conversations WHERE id = $1 AND (buyer_id = $2 OR seller_id = $2)',
      [conversationId, userId],
    );
    if (!conv.rows.length) {
      return res.status(403).json({ success: false, message: 'Erişim reddedildi.' });
    }

    const isBuyer = conv.rows[0].buyer_id === userId;
    const unreadField = isBuyer ? 'buyer_unread' : 'seller_unread';
    await query(`UPDATE conversations SET ${unreadField} = 0 WHERE id = $1`, [conversationId]);

    await query(
      `UPDATE messages SET status = 'read'
       WHERE conversation_id = $1 AND sender_id != $2 AND status != 'read'`,
      [conversationId, userId],
    );

    const { rows } = await query(
      `SELECT m.*, u.name AS sender_name, u.avatar_url AS sender_avatar
       FROM messages m
       JOIN users u ON u.id = m.sender_id
       WHERE m.conversation_id = $1 AND m.is_deleted = FALSE
       ORDER BY m.created_at DESC
       LIMIT $2 OFFSET $3`,
      [conversationId, perPage, offset],
    );

    res.json({ success: true, data: rows.reverse() });
  } catch (err) {
    next(err);
  }
};

const sendMessage = async (req, res, next) => {
  try {
    const { listing_id, conversation_id, content } = req.body;
    const senderId = req.user.id;

    const result = await withTransaction(async (client) => {
      let conversation;

      if (conversation_id) {
        const conv = await client.query(
          `SELECT conv.*
           FROM conversations conv
           WHERE conv.id = $1 AND (conv.buyer_id = $2 OR conv.seller_id = $2)`,
          [conversation_id, senderId],
        );
        if (!conv.rows.length) {
          const err = new Error('Konuşma bulunamadı.');
          err.status = 404;
          throw err;
        }
        conversation = conv.rows[0];
      } else {
        const listing = await client.query(
          'SELECT id, user_id, status FROM listings WHERE id = $1',
          [listing_id],
        );
        if (!listing.rows.length) {
          const err = new Error('İlan bulunamadı.');
          err.status = 404;
          throw err;
        }

        const sellerId = listing.rows[0].user_id;
        if (sellerId === senderId) {
          const err = new Error('Kendi ilanınıza mesaj gönderemezsiniz.');
          err.status = 400;
          throw err;
        }

        const existing = await client.query(
          'SELECT * FROM conversations WHERE listing_id = $1 AND buyer_id = $2',
          [listing_id, senderId],
        );

        if (existing.rows.length) {
          conversation = existing.rows[0];
        } else {
          const created = await client.query(
            'INSERT INTO conversations (listing_id, buyer_id, seller_id) VALUES ($1,$2,$3) RETURNING *',
            [listing_id, senderId, sellerId],
          );
          conversation = created.rows[0];
        }
      }

      const msg = await client.query(
        'INSERT INTO messages (conversation_id, sender_id, content) VALUES ($1,$2,$3) RETURNING *',
        [conversation.id, senderId, content],
      );

      const unreadField = senderId === conversation.buyer_id ? 'seller_unread' : 'buyer_unread';
      await client.query(
        `UPDATE conversations SET
           last_message = $1,
           last_message_at = NOW(),
           ${unreadField} = ${unreadField} + 1,
           updated_at = NOW()
         WHERE id = $2`,
        [content.substring(0, 100), conversation.id],
      );

      return { conversationId: conversation.id, conversation, message: msg.rows[0] };
    });

    const io = req.app.get('io');
    if (io) {
      const recipientId = senderId === result.conversation.buyer_id
        ? result.conversation.seller_id
        : result.conversation.buyer_id;
      io.to(`conversation_${result.conversationId}`).emit('new_message', result.message);
      io.to(`user_${recipientId}`).emit('new_conversation_message', {
        conversationId: result.conversationId,
        listingId: result.conversation.listing_id,
        preview: content.substring(0, 60),
      });
    }

    res.status(201).json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
};

const deleteMessage = async (req, res, next) => {
  try {
    const { messageId } = req.params;
    const { rows } = await query('SELECT sender_id FROM messages WHERE id = $1', [messageId]);
    if (!rows.length) return res.status(404).json({ success: false, message: 'Mesaj bulunamadı.' });
    if (rows[0].sender_id !== req.user.id) {
      return res.status(403).json({ success: false, message: 'Bu mesajı silemezsiniz.' });
    }
    await query('UPDATE messages SET is_deleted = TRUE, content = $1 WHERE id = $2', ['Bu mesaj silindi.', messageId]);
    res.json({ success: true, message: 'Mesaj silindi.' });
  } catch (err) {
    next(err);
  }
};

module.exports = { getConversations, getMessages, sendMessage, deleteMessage };
