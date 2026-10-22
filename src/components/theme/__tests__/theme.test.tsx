// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ThemeProvider, useTheme, THEME_STORAGE_KEY } from '../ThemeProvider';
import { ThemeToggle } from '../ThemeToggle';

function Probe() {
  const { theme, preference, setTheme } = useTheme();
  return (
    <>
      <output data-testid="state">{`${theme}/${preference}`}</output>
      <button onClick={() => setTheme('system')}>sistema</button>
    </>
  );
}

beforeEach(() => {
  localStorage.clear();
  document.documentElement.classList.remove('dark');
});

describe('ThemeProvider', () => {
  it('sin preferencia guardada sigue al sistema (claro en jsdom)', () => {
    render(
      <ThemeProvider>
        <Probe />
      </ThemeProvider>
    );
    expect(screen.getByTestId('state')).toHaveTextContent('light/system');
    expect(document.documentElement).not.toHaveClass('dark');
  });

  it('respeta la preferencia oscura guardada y aplica la clase', () => {
    localStorage.setItem(THEME_STORAGE_KEY, 'dark');
    render(
      <ThemeProvider>
        <Probe />
      </ThemeProvider>
    );
    expect(screen.getByTestId('state')).toHaveTextContent('dark/dark');
    expect(document.documentElement).toHaveClass('dark');
  });

  it('el toggle alterna el tema, lo persiste y actualiza la clase', async () => {
    render(
      <ThemeProvider>
        <Probe />
        <ThemeToggle />
      </ThemeProvider>
    );

    await userEvent.click(screen.getByRole('button', { name: 'Alternar tema claro/oscuro' }));
    expect(screen.getByTestId('state')).toHaveTextContent('dark/dark');
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('dark');
    expect(document.documentElement).toHaveClass('dark');

    await userEvent.click(screen.getByRole('button', { name: 'Alternar tema claro/oscuro' }));
    expect(screen.getByTestId('state')).toHaveTextContent('light/light');
    expect(document.documentElement).not.toHaveClass('dark');
  });

  it('puede volver a "system"', async () => {
    localStorage.setItem(THEME_STORAGE_KEY, 'dark');
    render(
      <ThemeProvider>
        <Probe />
      </ThemeProvider>
    );
    await userEvent.click(screen.getByRole('button', { name: 'sistema' }));
    expect(screen.getByTestId('state')).toHaveTextContent('light/system');
  });

  it('ignora valores inválidos en localStorage', () => {
    localStorage.setItem(THEME_STORAGE_KEY, 'rosa');
    render(
      <ThemeProvider>
        <Probe />
      </ThemeProvider>
    );
    expect(screen.getByTestId('state')).toHaveTextContent('light/system');
  });
});
