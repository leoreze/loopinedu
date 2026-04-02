import { query } from '../db/index.js';

export async function listStudents(req, res) {
  const result = await query('SELECT * FROM students WHERE tenant_id = $1 ORDER BY created_at DESC', [req.user.tenantId]);
  res.json(result.rows);
}

export async function createStudent(req, res) {
  const { full_name, grade_level, class_name, birth_date, school_name, guardian_name, guardian_email, guardian_phone, photo_data_url } = req.body;
  const result = await query(
    `
      INSERT INTO students (full_name, grade_level, class_name, birth_date, school_name, guardian_name, guardian_email, guardian_phone, photo_data_url, tenant_id)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING *
    `,
    [full_name, grade_level || null, class_name || null, birth_date || null, school_name || null, guardian_name || null, guardian_email || null, guardian_phone || null, photo_data_url || null, req.user.tenantId]
  );
  res.status(201).json(result.rows[0]);
}

export async function getStudent(req, res) {
  const result = await query('SELECT * FROM students WHERE id = $1 AND tenant_id = $2', [req.params.id, req.user.tenantId]);
  if (!result.rows[0]) return res.status(404).json({ error: 'Estudante não encontrado.' });
  res.json(result.rows[0]);
}

export async function updateStudent(req, res) {
  const { full_name, grade_level, class_name, birth_date, school_name, guardian_name, guardian_email, guardian_phone, photo_data_url } = req.body;
  const result = await query(
    `
      UPDATE students
      SET
        full_name = COALESCE($3, full_name),
        grade_level = COALESCE($4, grade_level),
        class_name = COALESCE($5, class_name),
        birth_date = COALESCE($6, birth_date),
        school_name = COALESCE($7, school_name),
        guardian_name = COALESCE($8, guardian_name),
        guardian_email = COALESCE($9, guardian_email),
        guardian_phone = COALESCE($10, guardian_phone),
        photo_data_url = COALESCE($11, photo_data_url)
      WHERE id = $1 AND tenant_id = $2
      RETURNING *
    `,
    [req.params.id, req.user.tenantId, full_name, grade_level, class_name, birth_date, school_name, guardian_name, guardian_email, guardian_phone, photo_data_url]
  );
  if (!result.rows[0]) return res.status(404).json({ error: 'Estudante não encontrado.' });
  res.json(result.rows[0]);
}

export async function getStudentHistory(req, res) {
  const result = await query(
    `
      SELECT a.*, c.title AS cycle_title
      FROM assessments a
      LEFT JOIN assessment_cycles c ON c.id = a.cycle_id
      INNER JOIN students s ON s.id = a.student_id
      WHERE a.student_id = $1 AND a.tenant_id = $2 AND s.tenant_id = $2
      ORDER BY a.created_at DESC
    `,
    [req.params.id, req.user.tenantId]
  );
  res.json(result.rows);
}
