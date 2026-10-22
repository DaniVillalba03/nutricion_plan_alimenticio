'use client';

import React, { useMemo, useState } from 'react';
import { MOCK_EXCHANGE_GROUPS, MOCK_SUBGROUPS } from '@/lib/mock-data';
import { useCatalog } from '@/components/catalog/CatalogProvider';
import { FoodState } from '@/types/nutrition';
import { normalizeText } from '@/core/exchange-engine';
import { FoodCalculatorModal } from '@/components/foods/FoodCalculatorModal';
import { Button, Card, PageHeader, Select, Tabs, useToast } from '@/components/ui';
import { cn } from '@/lib/utils';
import { Search, Calculator, SearchX } from 'lucide-react';

type StateFilter = 'all' | FoodState;

export default function FoodsCatalogPage() {
  const { toast } = useToast();
  const { foods: foodsList, addFood } = useCatalog();
  const [selectedGroupId, setSelectedGroupId] = useState<string>('all');
  const [selectedSubgroupId, setSelectedSubgroupId] = useState<string>('all');
  const [selectedState, setSelectedState] = useState<StateFilter>('all');
  const [onlyParaguayMarked, setOnlyParaguayMarked] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isCalculatorOpen, setIsCalculatorOpen] = useState(false);

  const groupsMap = useMemo(() => new Map(MOCK_EXCHANGE_GROUPS.map((g) => [g.id, g])), []);
  const subgroupsMap = useMemo(() => new Map(MOCK_SUBGROUPS.map((s) => [s.id, s])), []);

  const availableSubgroups = useMemo(
    () => (selectedGroupId === 'all' ? MOCK_SUBGROUPS : MOCK_SUBGROUPS.filter((s) => s.groupId === selectedGroupId)),
    [selectedGroupId]
  );

  const filteredFoods = useMemo(() => {
    const normQuery = normalizeText(searchQuery.trim());
    return foodsList.filter((food) => {
      if (selectedGroupId !== 'all' && food.groupId !== selectedGroupId) return false;
      if (selectedSubgroupId !== 'all' && food.subgroupId !== selectedSubgroupId) return false;
      if (selectedState !== 'all' && food.state !== selectedState) return false;
      if (onlyParaguayMarked && !food.isParaguayanMarked) return false;
      if (!normQuery) return true;

      return (
        normalizeText(food.name).includes(normQuery) ||
        (food.brand ? normalizeText(food.brand).includes(normQuery) : false) ||
        food.aliases.some((a) => normalizeText(a).includes(normQuery)) ||
        (food.tags || []).some((t) => normalizeText(t).includes(normQuery))
      );
    });
  }, [foodsList, selectedGroupId, selectedSubgroupId, selectedState, onlyParaguayMarked, searchQuery]);

  const hasFilters =
    searchQuery !== '' || selectedGroupId !== 'all' || selectedState !== 'all' || onlyParaguayMarked;

  const clearFilters = () => {
    setSearchQuery('');
    setSelectedGroupId('all');
    setSelectedSubgroupId('all');
    setSelectedState('all');
    setOnlyParaguayMarked(false);
  };

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Catálogo"
        title="Alimentos y equivalencias"
        description="Porción de 1 intercambio con sinónimos de Paraguay y marcas comerciales."
        actions={
          <Button variant="primary" onClick={() => setIsCalculatorOpen(true)}>
            <Calculator className="h-4 w-4" />
            Nuevo alimento
          </Button>
        }
      />

      <div className="space-y-4">
        <div className="relative">
          <Search className="pointer-events-none absolute left-4 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-subtle" />
          <input
            type="search"
            placeholder="Buscar por alimento, marca o sinónimo: mandioca, locote, pororó…"
            aria-label="Buscar alimentos"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="h-12 w-full rounded-lg border border-border-strong bg-surface pl-11 pr-4 text-base text-foreground placeholder:text-subtle focus:border-ring focus:outline-none focus:ring-[3px] focus:ring-ring/20"
          />
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Select
            aria-label="Grupo de intercambio"
            value={selectedGroupId}
            onChange={(e) => {
              setSelectedGroupId(e.target.value);
              setSelectedSubgroupId('all');
            }}
            className="h-9 w-auto text-sm"
          >
            <option value="all">Todos los grupos</option>
            {MOCK_EXCHANGE_GROUPS.map((g) => (
              <option key={g.id} value={g.id}>
                {g.name}
              </option>
            ))}
          </Select>

          {availableSubgroups.length > 0 && selectedGroupId !== 'all' && (
            <Select
              aria-label="Subgrupo"
              value={selectedSubgroupId}
              onChange={(e) => setSelectedSubgroupId(e.target.value)}
              className="h-9 w-auto text-sm"
            >
              <option value="all">Todos los subgrupos</option>
              {availableSubgroups.map((sub) => (
                <option key={sub.id} value={sub.id}>
                  {sub.name}
                </option>
              ))}
            </Select>
          )}

          <Tabs
            value={selectedState}
            onChange={setSelectedState}
            options={[
              { value: 'all', label: 'Todos' },
              { value: 'crudo', label: 'Crudo' },
              { value: 'cocido', label: 'Cocido' },
            ]}
          />

          <label className="flex cursor-pointer items-center gap-2 text-sm text-foreground">
            <input
              type="checkbox"
              checked={onlyParaguayMarked}
              onChange={(e) => setOnlyParaguayMarked(e.target.checked)}
              className="h-4 w-4 accent-[var(--primary)]"
            />
            Solo alimentos paraguayos (*)
          </label>

          {hasFilters && (
            <button
              type="button"
              onClick={clearFilters}
              className="text-sm text-muted underline-offset-4 hover:text-foreground hover:underline"
            >
              Limpiar filtros
            </button>
          )}
        </div>
      </div>

      <p className="text-sm text-muted" aria-live="polite">
        {filteredFoods.length} {filteredFoods.length === 1 ? 'alimento' : 'alimentos'}
      </p>

      {filteredFoods.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-border-strong px-6 py-16 text-center">
          <SearchX className="h-7 w-7 text-subtle" strokeWidth={1.5} />
          <div>
            <p className="text-xl font-bold tracking-[-0.03em] text-foreground">Sin resultados</p>
            <p className="mt-1 text-[15px] text-muted">Prueba con otro término o quita algunos filtros.</p>
          </div>
          <Button size="sm" onClick={clearFilters}>
            Limpiar filtros
          </Button>
        </div>
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-left">
              <thead>
                <tr className="border-b border-border bg-surface-muted/60 mono-label text-subtle">
                  <th scope="col" className="px-5 py-3.5 font-medium">Alimento</th>
                  <th scope="col" className="px-3 py-3.5 font-medium">Grupo</th>
                  <th scope="col" className="px-3 py-3.5 font-medium">Porción de 1 intercambio</th>
                  <th scope="col" className="px-5 py-3 text-right font-medium">Gramos</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filteredFoods.map((food) => {
                  const group = groupsMap.get(food.groupId);
                  if (!group) return null;
                  const subgroup = food.subgroupId ? subgroupsMap.get(food.subgroupId) : null;
                  const secondary = [
                    food.brand ? `Marca ${food.brand}` : null,
                    food.state !== 'no_aplica' ? food.state : null,
                    subgroup?.name ?? null,
                  ].filter(Boolean);

                  return (
                    <tr key={food.id} className="align-top transition-colors hover:bg-surface-muted/50">
                      <td className="px-5 py-3.5">
                        <p className="text-[15px] font-medium text-foreground">
                          {food.name}
                          {food.isParaguayanMarked && (
                            <span
                              className="ml-2 align-middle text-xs font-medium text-warning"
                              title="Alimento paraguayo"
                            >
                              PY*
                            </span>
                          )}
                        </p>
                        {secondary.length > 0 && (
                          <p className="mt-0.5 text-[13px] text-muted first-letter:uppercase">{secondary.join(' · ')}</p>
                        )}
                        {food.aliases.length > 0 && (
                          <p className="mt-0.5 text-[13px] text-subtle">También: {food.aliases.join(', ')}</p>
                        )}
                      </td>
                      <td className="px-3 py-3.5">
                        <span className="inline-flex items-center gap-2 text-sm text-foreground">
                          <span
                            className={cn('h-2 w-2 shrink-0 rounded-full')}
                            style={{ backgroundColor: group.color.accent }}
                            aria-hidden="true"
                          />
                          {group.shortName}
                        </span>
                        <p className="mt-0.5 pl-4 text-[13px] tabular-nums text-muted">
                          {group.referenceMacros.calories} kcal
                        </p>
                      </td>
                      <td className="px-3 py-3.5 text-[15px] text-foreground">{food.portionDescription}</td>
                      <td className="px-5 py-3.5 text-right text-[15px] tabular-nums text-foreground">
                        {food.baseGrams} g
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      <FoodCalculatorModal
        open={isCalculatorOpen}
        onClose={() => setIsCalculatorOpen(false)}
        onCreate={async (food, groupName) => {
          setIsCalculatorOpen(false);
          const result = await addFood(food);
          toast(
            result.ok ? `Alimento "${food.name}" agregado a "${groupName}"` : `No se pudo guardar el alimento: ${result.error}`,
            4000
          );
        }}
      />
    </div>
  );
}
