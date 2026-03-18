const pool = require("../config/db");

async function getAllDoctors(req, res) {
  try {
    const search = (req.query.search || "").toString().trim();
    const specialization = (req.query.specialization || "").toString().trim();

    const where = [];
    const params = [];
    if (search) {
      params.push(`%${search}%`);
      where.push(`(u.full_name ILIKE $${params.length} OR u.email ILIKE $${params.length})`);
    }
    if (specialization) {
      params.push(specialization);
      where.push(`d.specialization = $${params.length}`);
    }

    const sql = `
      SELECT
        u.id,
        u.full_name,
        u.email,
        u.avatar_url,
        d.specialization,
        d.experience_years,
        d.rating,
        d.bio
      FROM users u
      JOIN doctors d ON d.user_id = u.id
      WHERE u.role = 'doctor'
      ${where.length ? `AND ${where.join(" AND ")}` : ""}
      ORDER BY d.rating DESC, u.full_name ASC
    `;

    const result = await pool.query(sql, params);

    res.json(result.rows);
  } catch (error) {
    console.error("Error fetching doctors:", error.message);
    res.status(500).json({ message: "Failed to fetch doctors" });
  }
}

module.exports = {
  getAllDoctors,
};
