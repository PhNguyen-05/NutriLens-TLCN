const { calcSafeCalorieTarget } = require('./healthMetrics');

const MACRO_RATIOS = {
  lose_weight: { protein: 30, carbs: 40, fat: 30 },
  maintain_weight: { protein: 25, carbs: 50, fat: 25 },
  gain_weight: { protein: 25, carbs: 55, fat: 20 },
};

function buildNutritionGoal(goal, calorieTarget, macroPercentages, customized = false) {
  if (!calorieTarget || !Number.isFinite(Number(calorieTarget))) return null;
  const target = Math.round(Number(calorieTarget));
  return {
    goal,
    calorieTarget: target,
    macroPercentages,
    proteinG: Math.round((target * macroPercentages.protein) / 400),
    carbsG: Math.round((target * macroPercentages.carbs) / 400),
    fatG: Math.round((target * macroPercentages.fat) / 900),
    customized,
  };
}

function calculateNutritionProposal(metrics, goal, gender) {
  const calorieTarget = calcSafeCalorieTarget(metrics, goal, gender);
  if (!calorieTarget) return null;
  return buildNutritionGoal(goal, calorieTarget, MACRO_RATIOS[goal]);
}

module.exports = {
  MACRO_RATIOS,
  buildNutritionGoal,
  calculateNutritionProposal,
};
