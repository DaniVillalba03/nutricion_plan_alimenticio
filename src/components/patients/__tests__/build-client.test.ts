import { describe, it, expect } from 'vitest';
import { buildClientFromInput, macroGramsFromSplit, type ClientInput } from '../build-client';
import { ClientInputSchema } from '@/core/validators';

const split = { carbohydrates: 50, proteins: 20, lipids: 30 };

const validInput = (overrides: Partial<Record<string, unknown>> = {}): ClientInput =>
  ClientInputSchema.parse({
    fullName: '  Juan Pérez ',
    email: '',
    age: '30',
    gender: 'masculino',
    weightKg: '78',
    targetKcal: '2000',
    targetChoG: 250,
    targetProG: 100,
    targetLipG: 67,
    exclusions: ['Lactosa'],
    ...overrides,
  });

describe('macroGramsFromSplit', () => {
  it('convierte kcal y reparto % a gramos con factores 4/4/9', () => {
    expect(macroGramsFromSplit(2000, split)).toEqual({ carbohydrates: 250, proteins: 100, lipids: 67 });
  });

  it('respeta la regla Atwater dentro del redondeo', () => {
    const g = macroGramsFromSplit(1600, split);
    const kcal = g.carbohydrates * 4 + g.proteins * 4 + g.lipids * 9;
    expect(Math.abs(kcal - 1600)).toBeLessThanOrEqual(10);
  });

  it('devuelve ceros si no hay calorías', () => {
    expect(macroGramsFromSplit(0, split)).toEqual({ carbohydrates: 0, proteins: 0, lipids: 0 });
  });
});

describe('buildClientFromInput', () => {
  it('arma el paciente con las metas, el reparto y las restricciones', () => {
    const client = buildClientFromInput(validInput(), split);

    expect(client.fullName).toBe('Juan Pérez');
    expect(client.age).toBe(30);
    expect(client.gender).toBe('masculino');
    expect(client.targetCalories).toBe(2000);
    expect(client.targetMacros).toEqual({ carbohydrates: 250, proteins: 100, lipids: 67 });
    expect(client.macroDistributionPct).toEqual(split);
    expect(client.exclusions).toEqual(['Lactosa']);
    expect(client.isShareRevoked).toBe(false);
  });

  it('convierte campos opcionales vacíos en undefined', () => {
    const client = buildClientFromInput(validInput({ email: '', phone: '', activityLevel: '', notes: '' }), split);

    expect(client.email).toBeUndefined();
    expect(client.phone).toBeUndefined();
    expect(client.activityLevel).toBeUndefined();
    expect(client.notes).toBeUndefined();
  });

  it('genera ids y tokens de portal únicos por paciente', () => {
    const a = buildClientFromInput(validInput(), split);
    const b = buildClientFromInput(validInput(), split);

    expect(a.id).not.toBe(b.id);
    expect(a.shareToken).toBe(`token-${a.id.slice(0, 8)}`);
    expect(a.shareToken).not.toBe(b.shareToken);
  });
});

describe('ClientInputSchema (usado por el modal)', () => {
  it('rechaza edad vacía con mensaje en español', () => {
    const result = ClientInputSchema.safeParse({
      fullName: 'Ana Gómez',
      age: '',
      gender: 'femenino',
      weightKg: '60',
      targetKcal: '1800',
      targetChoG: 225,
      targetProG: 90,
      targetLipG: 60,
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((i) => i.path[0] === 'age' && i.message === 'Ingresa una edad válida')).toBe(true);
    }
  });
});
