import OpenAI from 'openai';
import { env } from '../config/env.js';

const client = env.openAiApiKey ? new OpenAI({ apiKey: env.openAiApiKey }) : null;

function fallbackInterpretation(payload) {
  const { scores, student } = payload;
  const dimensions = [
    ['cognitive', scores.cognitive],
    ['organization', scores.organization],
    ['relational', scores.relational],
    ['emotional', scores.emotional]
  ].sort((a, b) => b[1] - a[1]);

  const strongest = dimensions[0];
  const weakest = dimensions[dimensions.length - 1];

  return {
    summary: `${student.full_name} apresentou score geral ${scores.overall}, com melhor desempenho em ${strongest[0]} e maior atenção em ${weakest[0]}. O quadro sugere acompanhamento prático, com metas curtas e alinhamento entre escola e família.`,
    strengths: [`Melhor dimensão observada: ${strongest[0]}.`, 'Há sinais suficientes para construir intervenções pedagógicas orientadas por evidência.', 'O diagnóstico já permite definir prioridades objetivas para o próximo ciclo.'],
    risks: [`Dimensão com menor score: ${weakest[0]}.`, 'Recomenda-se cruzar este diagnóstico com histórico escolar e percepção familiar.', 'Oscilações entre respondentes podem indicar necessidade de escuta complementar.'],
    actionPlan: [
      'Realizar devolutiva com escola e família em linguagem clara e acolhedora.',
      'Definir 2 metas objetivas para os próximos 30 dias com responsáveis e equipe pedagógica.',
      'Acompanhar semanalmente sinais ligados à dimensão mais sensível do estudante.',
      'Reaplicar o diagnóstico no próximo ciclo para comparar evolução.'
    ]
  };
}

export async function interpretAssessment(payload) {
  if (!client) {
    return fallbackInterpretation(payload);
  }

  const prompt = `Você é um especialista em psicopedagogia, coordenação pedagógica e leitura socioemocional escolar. Analise o método C.O.R.E. 360 com foco prático. Retorne APENAS JSON válido com as chaves summary, strengths, risks e actionPlan. summary deve ser um texto executivo de até 120 palavras. strengths, risks e actionPlan devem ter de 3 a 5 itens cada, em português do Brasil, claros e acionáveis. Considere também o equilíbrio entre escola, família e estudante. Dados: ${JSON.stringify(payload)}`;

  try {
    const completion = await client.chat.completions.create({
      model: env.openAiModel,
      temperature: 0.3,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: 'Retorne sempre JSON válido e útil para coordenação pedagógica.' },
        { role: 'user', content: prompt }
      ]
    });

    const content = completion.choices?.[0]?.message?.content || '{}';
    const parsed = JSON.parse(content);

    return {
      summary: parsed.summary || '',
      strengths: Array.isArray(parsed.strengths) ? parsed.strengths : [],
      risks: Array.isArray(parsed.risks) ? parsed.risks : [],
      actionPlan: Array.isArray(parsed.actionPlan) ? parsed.actionPlan : []
    };
  } catch (error) {
    console.warn('[LoopinEdu][ai] fallback acionado:', error.message);
    return fallbackInterpretation(payload);
  }
}
