export function asyncHandler(fn) {
  return function wrapped(req, res, next) {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

export function toBand(score) {
  if (score <= 2) return 'Crítico';
  if (score <= 3) return 'Atenção';
  if (score <= 4) return 'Estável';
  return 'Destaque';
}

export function average(values = []) {
  if (!values.length) return 0;
  return values.reduce((sum, value) => sum + Number(value || 0), 0) / values.length;
}
