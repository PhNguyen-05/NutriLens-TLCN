/**
 * calorieValidator.js
 * Tiện ích kiểm tra tính tương quan và hợp lý giữa Calo và Macro (Protein, Carbs, Fat).
 * Công thức Atwater: Calo lý thuyết ≈ 4 × Protein + 4 × Carbs + 9 × Fat
 */

/**
 * Kiểm tra tính tương quan giữa Calo và 3 chất đa lượng.
 * @param {Object} params
 * @param {number|string} params.calories - Lượng Calo khai báo (kcal)
 * @param {number|string} params.protein - Lượng Protein (g)
 * @param {number|string} params.carbs - Lượng Carbs (g)
 * @param {number|string} params.fat - Lượng Fat (g)
 * @param {boolean} [params.allowDiscrepancy=false] - Cho phép bỏ qua nếu Admin đã xác nhận
 * @param {number} [params.threshold=0.30] - Ngưỡng sai lệch cho phép (mặc định 30%)
 * @param {number} [params.minDiffKcal=30] - Chênh lệch tối thiểu (kcal) để kích hoạt cảnh báo
 * @returns {{ valid: boolean, theoKcal: number, discrepancyPercent: number, message?: string }}
 */
function validateCaloriesAndMacros({
  calories,
  protein,
  carbs,
  fat,
  allowDiscrepancy = false,
  threshold = 0.30,
  minDiffKcal = 30,
}) {
  const cal = Number(calories);
  const p = Math.max(0, Number(protein) || 0);
  const c = Math.max(0, Number(carbs) || 0);
  const f = Math.max(0, Number(fat) || 0);

  const theoKcal = Math.round(p * 4 + c * 4 + f * 9);

  // Món có năng lượng xấp xỉ 0 (nước lọc, trà đá không đường, diet drink...)
  if (cal <= 5 && theoKcal <= 5) {
    return { valid: true, theoKcal, discrepancyPercent: 0 };
  }

  // Trường hợp phi lý: Calo cao (> 30 kcal) nhưng cả 3 chất Macro đều = 0g
  if (theoKcal === 0 && cal > 30) {
    if (!allowDiscrepancy) {
      return {
        valid: false,
        theoKcal: 0,
        discrepancyPercent: 100,
        message: `Món ăn có năng lượng ${cal} kcal nhưng cả 3 chỉ số Đạm (Protein), Đường bột (Carbs) và Chất béo (Fat) đều bằng 0g. Vui lòng nhập đầy đủ thông tin dinh dưỡng.`,
      };
    }
  }

  // Trường hợp phi lý: Macro rất lớn nhưng Calo khai báo bằng 0 hoặc quá nhỏ
  if (theoKcal > 30 && cal <= 5) {
    if (!allowDiscrepancy) {
      return {
        valid: false,
        theoKcal,
        discrepancyPercent: 100,
        message: `Tổng 3 chất đa lượng tương đương ~${theoKcal} kcal (4×${p}g P + 4×${c}g C + 9×${f}g F) nhưng lượng Calo khai báo chỉ là ${cal} kcal. Vui lòng kiểm tra lại.`,
      };
    }
  }

  if (theoKcal > 0) {
    const diff = Math.abs(cal - theoKcal);
    const base = Math.max(theoKcal, cal);
    const discrepancyRatio = diff / base;
    const discrepancyPercent = Math.round(discrepancyRatio * 100);

    // Nếu độ lệch vượt ngưỡng (30%) VÀ chênh lệch tuyệt đối > minDiffKcal (30 kcal)
    if (discrepancyRatio > threshold && diff > minDiffKcal) {
      if (!allowDiscrepancy) {
        return {
          valid: false,
          theoKcal,
          discrepancyPercent,
          message: `Lượng Calo khai báo (${cal} kcal) chênh lệch ${discrepancyPercent}% so với nhiệt lượng tính từ Macro (~${theoKcal} kcal = 4×${p}g Đạm + 4×${c}g Carbs + 9×${f}g Béo). Vui lòng kiểm tra lại hoặc xác nhận số liệu.`,
        };
      }
    }

    return { valid: true, theoKcal, discrepancyPercent };
  }

  return { valid: true, theoKcal, discrepancyPercent: 0 };
}

module.exports = { validateCaloriesAndMacros };
