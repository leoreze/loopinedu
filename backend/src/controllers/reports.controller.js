import { query } from '../db/index.js';
import { buildAssessmentHtmlReport, buildFamilyHtmlReport, renderAssessmentPdfBuffer } from '../services/pdf.service.js';

async function getReportRecord(assessmentId, tenantId) {
  const result = await query(`
    SELECT
      a.*,
      s.full_name AS student_name,
      s.grade_level,
      s.class_name,
      s.birth_date,
      s.guardian_name,
      s.guardian_email,
      s.school_name,
      c.title AS cycle_title,
      t.name AS tenant_name,
      t.slug AS tenant_slug,
      t.primary_color,
      t.logo_url,
      t.secondary_color,
      t.accent_color,
      t.branding_json
    FROM assessments a
    INNER JOIN students s ON s.id = a.student_id AND s.tenant_id = a.tenant_id
    LEFT JOIN assessment_cycles c ON c.id = a.cycle_id AND c.tenant_id = a.tenant_id
    LEFT JOIN tenants t ON t.id = a.tenant_id
    WHERE a.id = $1 AND a.tenant_id = $2
  `, [assessmentId, tenantId]);
  return result.rows[0];
}

export async function getReport(req, res) {
  const record = await getReportRecord(req.params.assessmentId, req.user.tenantId);
  if (!record) return res.status(404).json({ error: 'Relatório não encontrado.' });
  res.json(record);
}

export async function generateReport(req, res) {
  const record = await getReportRecord(req.params.assessmentId, req.user.tenantId);
  if (!record) return res.status(404).json({ error: 'Relatório não encontrado.' });

  const insert = await query(
    `INSERT INTO report_exports (assessment_id, file_url, export_type) VALUES ($1, $2, 'pdf') RETURNING *`,
    [req.params.assessmentId, `/api/reports/${req.params.assessmentId}/pdf`]
  );

  res.json({ export: insert.rows[0], report: record });
}

export async function getReportPdf(req, res) {
  const record = await getReportRecord(req.params.assessmentId, req.user.tenantId);
  if (!record) return res.status(404).send('Relatório não encontrado.');

  try {
    const pdfBuffer = await renderAssessmentPdfBuffer(record);
    if (pdfBuffer) {
      const disposition = req.query.download === '1' ? 'attachment' : 'inline';
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `${disposition}; filename="loopinedu-relatorio-${req.params.assessmentId}.pdf"`);
      return res.send(pdfBuffer);
    }
  } catch (error) {
    console.error('Falha ao gerar PDF institucional, retornando HTML premium:', error.message);
  }

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.send(buildAssessmentHtmlReport(record));
}

export async function getReportHtml(req, res) {
  const record = await getReportRecord(req.params.assessmentId, req.user.tenantId);
  if (!record) return res.status(404).send('Relatório não encontrado.');
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.send(buildAssessmentHtmlReport(record));
}

export async function getFamilyReport(req, res) {
  const record = await getReportRecord(req.params.assessmentId, req.user.tenantId);
  if (!record) return res.status(404).send('Relatório não encontrado.');
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.send(buildFamilyHtmlReport(record));
}
