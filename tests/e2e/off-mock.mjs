// Serveur Open Food Facts simulé pour les tests de bout en bout : aucun appel au vrai service.
import { createServer } from "node:http";

const PRODUCT = {
  code: "3017620422003",
  product_name_fr: "Pâte à tartiner noisettes",
  brands: "Marque Test",
  serving_quantity: 15,
  nutriments: { "energy-kcal_100g": 540, proteins_100g: 6, carbohydrates_100g: 57, fat_100g: 31, sugars_100g: 56 },
};

const port = Number(process.env.OFF_MOCK_PORT ?? 3199);

createServer((request, response) => {
  const url = new URL(request.url ?? "/", `http://localhost:${port}`);
  const json = (status, body) => {
    response.writeHead(status, { "Content-Type": "application/json" });
    response.end(JSON.stringify(body));
  };
  if (url.pathname === "/health") return json(200, { ok: true });
  if (url.pathname === `/api/v2/product/${PRODUCT.code}.json`)
    return json(200, { code: PRODUCT.code, product: PRODUCT });
  if (url.pathname.startsWith("/api/v2/product/")) return json(404, { status: 0, status_verbose: "product not found" });
  if (url.pathname === "/search") return json(200, { hits: [{ ...PRODUCT, brands: [PRODUCT.brands] }] });
  if (url.pathname === "/cgi/search.pl") return json(200, { products: [PRODUCT] });
  return json(404, {});
}).listen(port);
