const pool = require("../config/db");

async function listMyNotifications(req, res) {
  try {
    const userId = req.user.id;
    const result = await pool.query(
      `
      SELECT *
      FROM notifications
      WHERE user_id = $1
      ORDER BY created_at DESC
      LIMIT 50
      `,
      [userId]
    );
    res.json(result.rows);
  } catch (error) {
    console.error("Error fetching notifications:", error.message);
    res.status(500).json({ message: "Failed to fetch notifications" });
  }
}

async function markRead(req, res) {
  try {
    const userId = req.user.id;
    const id = Number(req.params.id);
    const result = await pool.query(
      `
      UPDATE notifications
      SET read_at = now()
      WHERE id = $1 AND user_id = $2
      RETURNING *
      `,
      [id, userId]
    );
    if (!result.rows[0]) return res.status(404).json({ message: "Not found" });
    res.json(result.rows[0]);
  } catch (error) {
    console.error("Error marking read:", error.message);
    res.status(500).json({ message: "Failed to update notification" });
  }
}

module.exports = { listMyNotifications, markRead };

