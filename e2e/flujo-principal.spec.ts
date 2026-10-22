import { test, expect } from '@playwright/test';

test.describe('flujo principal (modo demostración)', () => {
  test('ingresar, crear un paciente, editarlo y eliminarlo', async ({ page }) => {
    await page.goto('/login');
    // Sin Supabase el ingreso es de demostración: acepta cualquier dato
    await page.getByLabel('Correo electrónico').fill('lic@example.com');
    await page.getByLabel('Contraseña').fill('cualquier-clave');
    await page.getByRole('button', { name: /Ingresar/ }).click();
    await expect(page).toHaveURL(/\/dashboard/);

    await page.getByRole('link', { name: 'Pacientes' }).first().click();
    await expect(page.getByRole('heading', { name: 'Tus pacientes' })).toBeVisible();

    // Crear
    await page.getByRole('button', { name: 'Nuevo paciente' }).first().click();
    const crear = page.getByRole('dialog', { name: 'Nuevo paciente' });
    await crear.getByLabel('Nombre completo').fill('Paciente de Prueba');
    await crear.getByLabel('Edad').fill('33');
    await crear.getByLabel('Peso (kg)').fill('70');
    await crear.getByLabel('Calorías (kcal)').fill('1800');
    await crear.getByRole('button', { name: 'Crear paciente' }).click();
    await expect(page.getByRole('heading', { name: 'Paciente de Prueba' })).toBeVisible();

    // Editar
    await page.getByRole('button', { name: 'Editar a Paciente de Prueba' }).click();
    const editar = page.getByRole('dialog', { name: 'Editar paciente' });
    await editar.getByLabel('Peso (kg)').fill('68');
    await editar.getByRole('button', { name: 'Guardar cambios' }).click();
    await expect(page.getByText(/68 kg/)).toBeVisible();

    // Eliminar (con confirmación)
    await page.getByRole('button', { name: 'Eliminar a Paciente de Prueba' }).click();
    await page.getByRole('button', { name: 'Eliminar paciente' }).click();
    await expect(page.getByRole('heading', { name: 'Paciente de Prueba' })).toHaveCount(0);
  });

  test('el portal del paciente muestra el plan y permite marcar una comida', async ({ page }) => {
    await page.goto('/p/maria-elena-2026');
    await expect(page.getByRole('heading', { name: /Hola, María/ })).toBeVisible();
    await expect(page.getByText('0 de 4')).toBeVisible();

    await page.getByRole('button', { name: 'Marcar' }).first().click();
    await expect(page.getByText('1 de 4')).toBeVisible();
  });

  test('un enlace inexistente no revela nada', async ({ page }) => {
    await page.goto('/p/un-token-que-no-existe');
    await expect(page.getByRole('heading', { name: /ya no está disponible/ })).toBeVisible();
  });
});

test.describe('constructor de planes', () => {
  test('guarda solo tras editar y muestra el estado del guardado', async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel('Correo electrónico').fill('lic@example.com');
    await page.getByLabel('Contraseña').fill('cualquier-clave');
    await page.getByRole('button', { name: /Ingresar/ }).click();
    await expect(page).toHaveURL(/\/dashboard/);

    const estado = page.getByRole('status').filter({ hasText: /Guardado|Guardando|Cambios sin guardar/ });
    await expect(estado).toHaveText('Guardado');

    // Editar: sube un cuarto de intercambio del primer alimento
    await page.getByRole('button', { name: 'Añadir un cuarto de intercambio' }).first().click();
    await expect(estado).toHaveText('Cambios sin guardar');

    // Sin pulsar nada, tras la pausa se guarda sola
    await expect(estado).toHaveText('Guardado', { timeout: 10_000 });
  });
});
