// Selecionador de modelo por custo/urgência e contexto
// Pode receber: (taskType, { tenant, promptLength, budgetStatus })
module.exports = function selectModel(taskType = 'default', ctx = {}) {
  const { promptLength = 0, budgetStatus = {} } = ctx;
  // Preferir modelos baratos para prompts curtos
  if (taskType === 'summary') return (promptLength < 500 ? 'small-model' : 'large-model');
  if (taskType === 'final') {
    // se orçamento crítico, reduzir para small-model e sinalizar
    if (budgetStatus.mode === 'restrict') return 'small-model';
    return (promptLength < 800 ? 'large-model' : 'large-model');
  }
  if (taskType === 'image') return 'vision-model';
  // padrão: considerar orçamento
  if (budgetStatus.mode === 'restrict') return 'small-model';
  return (promptLength < 400 ? 'small-model' : 'large-model');
};
