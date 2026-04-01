export function notFoundMiddleware(req, res) {
  res.status(404).json({ error: 'Rota não encontrada.' });
}

export function errorMiddleware(error, req, res, next) {
  console.error('[LoopinEdu][error]', error);

  const status = error.status || 500;
  const message = error.message || 'Erro interno do servidor.';

  res.status(status).json({
    error: message,
    details: process.env.NODE_ENV === 'production' ? undefined : error.stack
  });
}
