// Minimal OpenFoodFacts helper: fetch product by barcode and normalize key names
export async function fetchProductFromOFF(barcode) {
  const url = `https://world.openfoodfacts.org/api/v0/product/${encodeURIComponent(barcode)}.json`;
  try {
    const res = await fetch(url, { method: 'GET' });
    if (!res.ok) return null;
    const json = await res.json();
    if (!json || json.status !== 1) return null;
    const p = json.product || {};

    // Normalize nutriments: prefer _100g keys where available
    const nutr = p.nutriments || {};
    const normalized = {
      product_name: p.product_name || p.name || '',
      ingredients_text: p.ingredients_text || p.ingredients_text_en || '',
      nutriments: {
        sugars_100g: nutr.sugars_100g || nutr.sugars || 0,
        fat_100g: nutr.fat_100g || nutr.fat || 0,
        salt_100g: nutr.salt_100g || nutr['sodium_100g'] || nutr.salt || 0,
        // keep raw nutr object for any additional lookups
        __raw: nutr,
      },
      brands: p.brands || '',
      categories: p.categories || '',
      image_url: p.image_small_url || p.image_url || '',
      raw: p,
    };

    return normalized;
  } catch (err) {
    console.warn('OFF fetch failed', err.message);
    return null;
  }
}
