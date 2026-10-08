import { describe, it, expect } from "vitest";
import { costoApuTotal, utilidadLineaApu, ventaNetaLinea } from "../src/lib/domain/apu";

describe("APU", () => {
  it("costo APU suma material, mano de obra y otros", () => {
    expect(costoApuTotal({ costo_material: 4000, mano_obra: 1000, otros_costos: 500 })).toBe(5500);
  });
  it("utilidad = venta neta − costo APU × m²", () => {
    expect(utilidadLineaApu(79900, 10, 5500)).toBe(24900);
  });
  it("venta neta usa precio por metro lineal cuando existe", () => {
    expect(ventaNetaLinea({ metros2: 9, largo_m: 3, cantidad_planchas: 2, precio_m2: 1000, precio_ml: 5000 })).toBe(30000);
  });
});

import { saldoConIva } from "../src/lib/domain/quotes.core";
describe("saldo con IVA", () => {
  it("saldo = total neto con 19% IVA − pagado", () => {
    expect(saldoConIva(100000, 50000)).toBe(69000);
  });
  it("saldo nunca es negativo", () => {
    expect(saldoConIva(100000, 200000)).toBe(0);
  });
});
