export const rolePermissions = {
  admin: {
    label: 'Admin',
    description: 'Acesso total ao ambiente institucional.',
    abilities: ['manage_users', 'manage_cycles', 'manage_students', 'manage_assessments', 'view_reports', 'manage_billing']
  },
  coordinator: {
    label: 'Coordinator',
    description: 'Cria ciclos, acompanha estudantes e fecha diagnósticos.',
    abilities: ['manage_cycles', 'manage_students', 'manage_assessments', 'view_reports']
  },
  teacher: {
    label: 'Teacher',
    description: 'Responde avaliações e consulta o que for permitido.',
    abilities: ['respond_assessments', 'view_allowed_students']
  },
  specialist: {
    label: 'Specialist',
    description: 'Analisa relatórios e plano de ação.',
    abilities: ['view_reports', 'review_action_plan']
  }
};

export function roleCan(role, ability) {
  return Boolean(rolePermissions[role]?.abilities?.includes(ability));
}
