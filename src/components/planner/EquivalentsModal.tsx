'use client';

import React, { useState, useMemo } from 'react';
import { ExchangeGroup, Food, Client } from '@/types/nutrition';
import { getFoodEquivalents, formatFriendlyFraction } from '@/core/exchange-engine';
import { Search, Check, AlertTriangle, Scale, Sparkles, Info, ShieldBan, UtensilsCrossed } from 'lucide-react';
import { Modal, Button, Badge } from '@/components/ui';
import { cn } from '@/lib/utils';

interface EquivalentsModalProps {
  isOpen: boolean;
  onClose: () => void;
  group?: ExchangeGroup;
  exchangeCount: number;
  client: Client;
  allFoods: Food[];
  selectedFoodId?: string;
  onSelectFood: (foodId: string) => void;
}

export function EquivalentsModal({
  isOpen,
  onClose,
  group,
  exchangeCount,
  client,
  allFoods,
  selectedFoodId,
  onSelectFood,
}: EquivalentsModalProps) {
  const [searchQuery, setSearchQuery] = useState('');

  // Calcular equivalentes usando el motor puro
  const equivalents = useMemo(() => {
    if (!group) return [];
    return getFoodEquivalents(group.id, exchangeCount, allFoods, client, searchQuery);
  }, [group, exchangeCount, allFoods, client, searchQuery]);

  const totalCalories = group ? Math.round(group.referenceMacros.calories * exchangeCount) : 0;
  const totalCarbs = group ? Math.round(group.referenceMacros.carbohydrates * exchangeCount * 10) / 10 : 0;
  const totalProtein = group ? Math.round(group.referenceMacros.proteins * exchangeCount * 10) / 10 : 0;
  const totalLipids = group ? Math.round(group.referenceMacros.lipids * exchangeCount * 10) / 10 : 0;

  return (
    <Modal
      open={isOpen && !!group}
      onClose={onClose}
      size="xl"
      title="Alimentos equivalentes"
      description={`Todas las opciones aportan ${totalCalories} kcal (${totalCarbs}g CHO, ${totalProtein}g PRO, ${totalLipids}g LIP), adaptadas a porciones de Paraguay.`}
      footer={
        <>
          <span className="mr-auto flex items-center gap-1.5 text-xs text-muted">
            <Info className="h-4 w-4 text-subtle" />
            {equivalents.length} equivalencias exactas
          </span>
          <Button onClick={onClose}>Cerrar</Button>
        </>
      }
    >
      {group && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <span className={cn('rounded-lg border px-2.5 py-1 text-xs font-semibold', group.color.badge)}>
              {group.name}
            </span>
            <Badge tone="primary">
              {formatFriendlyFraction(exchangeCount)} {exchangeCount === 1 ? 'intercambio' : 'intercambios'}
            </Badge>
            <span className="text-xs text-muted">= {totalCalories} kcal</span>
          </div>

          {client.exclusions && client.exclusions.length > 0 && (
            <div className="flex items-start gap-2 rounded-xl bg-warning-soft px-3 py-2 text-xs text-warning-soft-foreground">
              <ShieldBan className="mt-0.5 h-4 w-4 shrink-0" />
              <span>
                <strong>Restricciones de {client.fullName}:</strong> {client.exclusions.join(', ')}. Los alimentos
                incompatibles están marcados con aviso de exclusión.
              </span>
            </div>
          )}

          <div className="relative">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-subtle" />
            <input
              type="search"
              aria-label="Buscar equivalentes"
              placeholder="Buscar por nombre o sinónimo (mandioca, locote, pororó, chipa...)"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-10 w-full rounded-xl border border-border bg-surface pl-10 pr-4 text-sm text-foreground placeholder:text-subtle focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/30"
            />
          </div>

          {equivalents.length === 0 ? (
            <div className="px-4 py-12 text-center">
              <UtensilsCrossed className="mx-auto mb-3 h-10 w-10 text-subtle" />
              <p className="text-sm font-semibold text-foreground">No se encontraron alimentos en este grupo</p>
              <p className="mt-1 text-xs text-muted">Intenta con otro término de búsqueda o limpia el filtro.</p>
            </div>
          ) : (
            <ul className="space-y-3">
              {equivalents.map((item) => {
                const isSelected = selectedFoodId === item.food.id;
                return (
                  <li
                    key={item.food.id}
                    className={cn(
                      'flex flex-col items-start justify-between gap-3 rounded-2xl border p-4 transition-colors sm:flex-row sm:items-center',
                      item.isExcluded
                        ? 'border-danger/30 bg-danger-soft'
                        : isSelected
                          ? 'border-primary bg-primary-soft'
                          : 'border-border bg-surface hover:border-border-strong'
                    )}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-bold text-foreground sm:text-base">{item.food.name}</span>
                        {item.food.state !== 'no_aplica' && <Badge className="uppercase">{item.food.state}</Badge>}
                        {isSelected && (
                          <Badge tone="primary">
                            <Check className="h-3 w-3" /> Sugerido actual
                          </Badge>
                        )}
                      </div>

                      <p className="mt-1.5 text-sm font-bold text-primary sm:text-base">{item.formattedHousehold}</p>

                      <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted">
                        <span className="flex items-center gap-1">
                          <Scale className="h-3 w-3" /> Base 1 int: {item.food.portionDescription}
                        </span>
                        {item.food.aliases && item.food.aliases.length > 0 && (
                          <span>· Sinónimos: {item.food.aliases.slice(0, 3).join(', ')}</span>
                        )}
                      </div>

                      {item.isExcluded && (
                        <div className="mt-2 inline-flex items-center gap-1.5 rounded-lg bg-danger/15 px-2.5 py-1 text-xs font-semibold text-danger-soft-foreground">
                          <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                          <span>{item.exclusionReason}</span>
                        </div>
                      )}
                    </div>

                    <Button
                      size="sm"
                      variant={isSelected ? 'primary' : 'secondary'}
                      disabled={item.isExcluded}
                      onClick={() => {
                        onSelectFood(item.food.id);
                        onClose();
                      }}
                      className="shrink-0 self-end sm:self-center"
                    >
                      {isSelected ? (
                        <>
                          <Check className="h-3.5 w-3.5" /> Seleccionado
                        </>
                      ) : (
                        <>
                          <Sparkles className="h-3.5 w-3.5" /> Fijar sugerido
                        </>
                      )}
                    </Button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </Modal>
  );
}
