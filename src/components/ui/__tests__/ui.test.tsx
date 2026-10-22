// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Button, Badge, Field, Input, Modal, Tabs, ToastProvider, useToast } from '@/components/ui';
import { Popover, MenuItem } from '@/components/ui/Popover';
import { cn } from '@/lib/utils';

describe('cn', () => {
  it('resuelve conflictos de Tailwind y descarta falsos', () => {
    expect(cn('px-2 py-1', false && 'hidden', 'px-4')).toBe('py-1 px-4');
  });
});

describe('Button / Badge', () => {
  it('es type="button" por defecto y dispara onClick', async () => {
    const onClick = vi.fn();
    render(<Button onClick={onClick}>Guardar</Button>);
    const btn = screen.getByRole('button', { name: 'Guardar' });
    expect(btn).toHaveAttribute('type', 'button');
    await userEvent.click(btn);
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('no dispara onClick si está deshabilitado', async () => {
    const onClick = vi.fn();
    render(
      <Button disabled onClick={onClick}>
        X
      </Button>
    );
    await userEvent.click(screen.getByRole('button'));
    expect(onClick).not.toHaveBeenCalled();
  });

  it('Badge aplica el tono pedido', () => {
    render(<Badge tone="danger">Sin Lactosa</Badge>);
    expect(screen.getByText('Sin Lactosa').className).toContain('bg-danger-soft');
  });
});

describe('Field', () => {
  it('asocia la etiqueta con el control y expone el error', () => {
    render(<Field label="Edad" error="Ingresa una edad válida">{(p) => <Input {...p} />}</Field>);
    const input = screen.getByLabelText('Edad');
    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(input).toHaveAccessibleDescription('Ingresa una edad válida');
  });

  it('muestra la ayuda cuando no hay error', () => {
    render(<Field label="Nombre" hint="Como en el DNI">{(p) => <Input {...p} />}</Field>);
    expect(screen.getByLabelText('Nombre')).not.toHaveAttribute('aria-invalid');
    expect(screen.getByLabelText('Nombre')).toHaveAccessibleDescription('Como en el DNI');
  });
});

describe('Modal', () => {
  it('no renderiza contenido cuando está cerrado', () => {
    render(
      <Modal open={false} onClose={() => {}} title="Título">
        Contenido
      </Modal>
    );
    expect(screen.queryByText('Contenido')).not.toBeInTheDocument();
  });

  it('muestra título, contenido y pie al abrir', () => {
    render(
      <Modal open onClose={() => {}} title="Nuevo paciente" footer={<button>Aceptar</button>}>
        Contenido
      </Modal>
    );
    expect(screen.getByRole('heading', { name: 'Nuevo paciente' })).toBeInTheDocument();
    expect(screen.getByText('Contenido')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Aceptar' })).toBeInTheDocument();
  });

  it('cierra con el botón de cerrar y bloquea el scroll del body mientras está abierto', async () => {
    const onClose = vi.fn();
    const { rerender } = render(
      <Modal open onClose={onClose} title="T">
        x
      </Modal>
    );
    expect(document.body.style.overflow).toBe('hidden');
    await userEvent.click(screen.getByRole('button', { name: 'Cerrar' }));
    expect(onClose).toHaveBeenCalledTimes(1);

    rerender(
      <Modal open={false} onClose={onClose} title="T">
        x
      </Modal>
    );
    expect(document.body.style.overflow).toBe('');
  });
});

describe('Popover', () => {
  it('abre, cierra con Esc y cierra al elegir una opción', async () => {
    render(
      <Popover trigger="Más">
        {(close) => <MenuItem onClick={close}>Duplicar</MenuItem>}
      </Popover>
    );
    expect(screen.queryByText('Duplicar')).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Más' }));
    expect(screen.getByText('Duplicar')).toBeInTheDocument();

    await userEvent.keyboard('{Escape}');
    expect(screen.queryByText('Duplicar')).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Más' }));
    await userEvent.click(screen.getByText('Duplicar'));
    expect(screen.queryByText('Duplicar')).not.toBeInTheDocument();
  });

  it('cierra al hacer clic fuera', async () => {
    render(
      <div>
        <span>fuera</span>
        <Popover trigger="Abrir">{() => <p>panel</p>}</Popover>
      </div>
    );
    await userEvent.click(screen.getByRole('button', { name: 'Abrir' }));
    expect(screen.getByText('panel')).toBeInTheDocument();
    await userEvent.click(screen.getByText('fuera'));
    expect(screen.queryByText('panel')).not.toBeInTheDocument();
  });
});

describe('Tabs', () => {
  it('marca la pestaña activa y avisa el cambio', async () => {
    const onChange = vi.fn();
    render(
      <Tabs
        value="all"
        onChange={onChange}
        options={[
          { value: 'all', label: 'Todos' },
          { value: 'crudo', label: 'Crudo' },
        ]}
      />
    );
    expect(screen.getByRole('tab', { name: 'Todos' })).toHaveAttribute('aria-selected', 'true');
    await userEvent.click(screen.getByRole('tab', { name: 'Crudo' }));
    expect(onChange).toHaveBeenCalledWith('crudo');
  });
});

describe('Toast', () => {
  function Trigger() {
    const { toast } = useToast();
    return <button onClick={() => toast('Guardado', 1000)}>go</button>;
  }

  it('muestra el aviso y lo oculta tras la duración', async () => {
    vi.useFakeTimers();
    render(
      <ToastProvider>
        <Trigger />
      </ToastProvider>
    );

    act(() => screen.getByText('go').click());
    expect(screen.getByText('Guardado')).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(1001);
    });
    expect(screen.queryByText('Guardado')).not.toBeInTheDocument();
    vi.useRealTimers();
  });

  it('useToast falla fuera del proveedor', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => render(<Trigger />)).toThrow(/ToastProvider/);
    spy.mockRestore();
  });
});
