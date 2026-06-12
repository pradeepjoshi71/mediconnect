const db = require("../config/db");

async function findExpenseById(id, hospitalId) {
  const result = await db.query(
    `
      SELECT 
        e.id,
        e.hospital_id AS "hospitalId",
        e.category,
        e.amount,
        e.description,
        e.expense_date AS "expenseDate",
        e.created_by AS "createdBy",
        u.full_name AS "createdByName",
        e.created_at AS "createdAt",
        e.updated_at AS "updatedAt"
      FROM expenses e
      LEFT JOIN users u ON u.id = e.created_by
      WHERE e.id = $1 AND e.hospital_id = $2
    `,
    [id, hospitalId]
  );
  return result.rows[0] || null;
}

async function listExpenses(hospitalId, { category, startDate, endDate }) {
  const params = [hospitalId];
  const where = ["e.hospital_id = $1"];

  if (category) {
    params.push(category);
    where.push(`e.category = $${params.length}`);
  }
  if (startDate) {
    params.push(startDate);
    where.push(`e.expense_date >= $${params.length}`);
  }
  if (endDate) {
    params.push(endDate);
    where.push(`e.expense_date <= $${params.length}`);
  }

  const result = await db.query(
    `
      SELECT 
        e.id,
        e.hospital_id AS "hospitalId",
        e.category,
        e.amount,
        e.description,
        e.expense_date AS "expenseDate",
        e.created_by AS "createdBy",
        u.full_name AS "createdByName",
        e.created_at AS "createdAt",
        e.updated_at AS "updatedAt"
      FROM expenses e
      LEFT JOIN users u ON u.id = e.created_by
      WHERE ${where.join(" AND ")}
      ORDER BY e.expense_date DESC, e.created_at DESC
    `,
    params
  );
  return result.rows;
}

async function createExpense({ hospitalId, category, amount, description, expenseDate, createdBy }) {
  const result = await db.query(
    `
      INSERT INTO expenses (hospital_id, category, amount, description, expense_date, created_by)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING id
    `,
    [hospitalId, category, amount, description, expenseDate || new Date(), createdBy]
  );
  return findExpenseById(result.rows[0].id, hospitalId);
}

async function updateExpense(id, hospitalId, { category, amount, description, expenseDate }) {
  const result = await db.query(
    `
      UPDATE expenses
      SET
        category = COALESCE($3, category),
        amount = COALESCE($4, amount),
        description = COALESCE($5, description),
        expense_date = COALESCE($6, expense_date),
        updated_at = now()
      WHERE id = $1 AND hospital_id = $2
      RETURNING id
    `,
    [id, hospitalId, category, amount, description, expenseDate]
  );
  return result.rows[0] ? findExpenseById(result.rows[0].id, hospitalId) : null;
}

async function deleteExpense(id, hospitalId) {
  const result = await db.query(
    `
      DELETE FROM expenses
      WHERE id = $1 AND hospital_id = $2
      RETURNING id
    `,
    [id, hospitalId]
  );
  return result.rowCount > 0;
}

async function getRevenueDashboardMetrics(hospitalId) {
  // 1. Daily, Weekly, Monthly, Yearly Revenue totals and Pending Payments
  const statsRes = await db.query(
    `
      SELECT
        COALESCE(SUM(CASE WHEN paid_at >= date_trunc('day', now()) THEN amount ELSE 0 END), 0.00)::double precision AS "dailyRevenue",
        COALESCE(SUM(CASE WHEN paid_at >= date_trunc('day', now()) - interval '6 days' THEN amount ELSE 0 END), 0.00)::double precision AS "weeklyRevenue",
        COALESCE(SUM(CASE WHEN paid_at >= date_trunc('day', now()) - interval '29 days' THEN amount ELSE 0 END), 0.00)::double precision AS "monthlyRevenue",
        COALESCE(SUM(CASE WHEN paid_at >= date_trunc('day', now()) - interval '364 days' THEN amount ELSE 0 END), 0.00)::double precision AS "yearlyRevenue",
        COALESCE((SELECT SUM(amount) FROM payments WHERE hospital_id = $1 AND status IN ('pending', 'processing')), 0.00)::double precision AS "pendingPayments"
      FROM payments
      WHERE hospital_id = $1 AND status = 'paid'
    `,
    [hospitalId]
  );

  // 2. Revenue by Doctor
  const doctorRes = await db.query(
    `
      SELECT 
        d.id AS "doctorId",
        u.full_name AS "doctorName",
        d.specialization,
        COALESCE(SUM(p.amount), 0.00)::double precision AS "amount"
      FROM doctors d
      JOIN users u ON u.id = d.user_id
      JOIN appointments a ON a.doctor_id = d.id
      JOIN invoices inv ON inv.appointment_id = a.id
      JOIN payments p ON p.invoice_id = inv.id
      WHERE p.hospital_id = $1 AND p.status = 'paid'
      GROUP BY d.id, u.full_name, d.specialization
      ORDER BY "amount" DESC
    `,
    [hospitalId]
  );

  // 3. Revenue by Service/Item Type
  const serviceRes = await db.query(
    `
      SELECT 
        ii.item_type AS "serviceType",
        COALESCE(SUM(ii.total_price), 0.00)::double precision AS "amount"
      FROM invoice_items ii
      JOIN invoices inv ON inv.id = ii.invoice_id
      WHERE inv.hospital_id = $1 AND inv.status = 'paid'
      GROUP BY ii.item_type
      ORDER BY "amount" DESC
    `,
    [hospitalId]
  );

  return {
    summary: statsRes.rows[0],
    revenueByDoctor: doctorRes.rows,
    revenueByService: serviceRes.rows,
  };
}

async function getProfitLossSummary(hospitalId) {
  // 1. Consolidated summary
  const summaryRes = await db.query(
    `
      SELECT
        (SELECT COALESCE(SUM(amount), 0.00) FROM payments WHERE hospital_id = $1 AND status = 'paid')::double precision AS "totalRevenue",
        (SELECT COALESCE(SUM(amount), 0.00) FROM expenses WHERE hospital_id = $1)::double precision AS "totalExpenses"
    `,
    [hospitalId]
  );

  const { totalRevenue, totalExpenses } = summaryRes.rows[0];
  const netProfit = totalRevenue - totalExpenses;

  // 2. Monthly Trends (12 months)
  const trendsRes = await db.query(
    `
      WITH monthly_revenue AS (
        SELECT 
          date_trunc('month', paid_at)::date AS month_bucket,
          COALESCE(SUM(amount), 0.00) AS revenue
        FROM payments
        WHERE hospital_id = $1 AND status = 'paid' AND paid_at >= date_trunc('month', now()) - interval '11 months'
        GROUP BY month_bucket
      ),
      monthly_expenses AS (
        SELECT 
          date_trunc('month', expense_date)::date AS month_bucket,
          COALESCE(SUM(amount), 0.00) AS expenses
        FROM expenses
        WHERE hospital_id = $1 AND expense_date >= date_trunc('month', now()) - interval '11 months'
        GROUP BY month_bucket
      ),
      months AS (
        SELECT generate_series(
          date_trunc('month', now()) - interval '11 months',
          date_trunc('month', now()),
          interval '1 month'
        )::date AS month_bucket
      )
      SELECT 
        to_char(m.month_bucket, 'YYYY-MM') AS month,
        to_char(m.month_bucket, 'Mon YY') AS label,
        COALESCE(r.revenue, 0.00)::double precision AS revenue,
        COALESCE(e.expenses, 0.00)::double precision AS expenses,
        (COALESCE(r.revenue, 0.00) - COALESCE(e.expenses, 0.00))::double precision AS profit
      FROM months m
      LEFT JOIN monthly_revenue r ON r.month_bucket = m.month_bucket
      LEFT JOIN monthly_expenses e ON e.month_bucket = m.month_bucket
      ORDER BY m.month_bucket ASC
    `,
    [hospitalId]
  );

  return {
    totalRevenue,
    totalExpenses,
    netProfit,
    monthlyTrends: trendsRes.rows,
  };
}

module.exports = {
  findExpenseById,
  listExpenses,
  createExpense,
  updateExpense,
  deleteExpense,
  getRevenueDashboardMetrics,
  getProfitLossSummary,
};
