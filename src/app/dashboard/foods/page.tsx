'use client';

import React, { useMemo, useState } from 'react';
import { MOCK_EXCHANGE_GROUPS, MOCK_SUBGROUPS, MOCK_FOODS } from '@/lib/mock-data';
import { Food, FoodState } from '@/types/nutrition';
import { normalizeText } from '@/core/exchange-engine';
import { FoodCard } from '@/components/foods/FoodCard';
import { FoodCalculatorModal } from '@/components/foods/FoodCalculatorModal';
import { Button, Card, Select, Tabs, useToast } from '@/components/ui';
import { cn } from '@/lib/utils';
import { Search, Calculator, Award, SearchX } from 'lucide-react';

type StateFilter = 'all' | FoodState;

export default function FoodsCatalogPage() {
  const { toast } = useToast();
  const [foodsList, setFoodsList] = useState<Food[]>(MOCK_FOODS);
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

  const selectGroup = (id: string) => {
    setSelectedGroupId(id);
    setSelectedSubgroupId('all');
  };

  const clearFilters = () => {
    setSearchQuery('');
    selectGroup('all');
    setSelectedState('all');
    setOnlyParaguayMarked(false);
  };

  const chip = (active: boolean) =>
    cn(
      'inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition-colors',
      active
        ? 'bg-accent text-accent-foreground'
        : 'border border-border bg-surface text-muted hover:bg-surface-muted hover:text-foreground'
    );

  return (
    <div className="space-y-6 pb-12">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-primary">Catálogo oficial PY</p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
            Alimentos y equivalencias
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-muted">
            Porciones base de 1 intercambio con sinónimos de Paraguay, marcas comerciales y calculadora por 100 g.
          </p>
        </div>
        <Button variant="primary" onClick={() => setIsCalculatorOpen(true)} className="shrink-0">
          <Calculator className="h-4 w-4" />
          Nuevo alimento
        </Button>
      </div>

      <Card className="space-y-4 p-4 sm:p-5">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-subtle" />
          <input
            type="search"
            placeholder="Buscar alimento, marca o sinónimo (mandioca, locote, pororó, La Palmera...)"
            aria-label="Buscar alimentos"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="h-11 w-full rounded-xl border border-border bg-surface pl-10 pr-4 text-sm text-foreground placeholder:text-subtle focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/30"
          />
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          <button type="button" onClick={() => selectGroup('all')} className={chip(selectedGroupId === 'all')}>
            Todos
            <span className="opacity-70">{foodsList.length}</span>
          </button>
          {MOCK_EXCHANGE_GROUPS.map((group) => (
            <button
              key={group.id}
              type="button"
              onClick={() => selectGroup(group.id)}
              className={chip(selectedGroupId === group.id)}
            >
              {group.shortName}
              <span className="opacity-70">{foodsList.filter((f) => f.groupId === group.id).length}</span>
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
          <div className="flex flex-wrap items-center gap-3">
            {availableSubgroups.length > 0 && (
              <Select
                aria-label="Subgrupo"
                value={selectedSubgroupId}
                onChange={(e) => setSelectedSubgroupId(e.target.value)}
                className="h-9 w-auto text-xs"
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
          </div>

          <button
            type="button"
            aria-pressed={onlyParaguayMarked}
            onClick={() => setOnlyParaguayMarked((v) => !v)}
            className={cn(
              'inline-flex h-9 items-center gap-1.5 rounded-xl px-3 text-xs font-semibold transition-colors',
              onlyParaguayMarked
                ? 'bg-warning text-white'
                : 'bg-warning-soft text-warning-soft-foreground hover:opacity-80'
            )}
          >
            <Award className="h-3.5 w-3.5" />
            Sello comercial Paraguay (*)
          </button>
        </div>
      </Card>

      <p className="text-xs text-muted" aria-live="polite">
        {filteredFoods.length} {filteredFoods.length === 1 ? 'alimento' : 'alimentos'}
      </p>

      {filteredFoods.length === 0 ? (
        <Card className="flex flex-col items-center gap-3 px-6 py-14 text-center">
          <SearchX className="h-8 w-8 text-subtle" />
          <div>
            <p className="font-semibold text-foreground">Sin resultados</p>
            <p className="text-sm text-muted">Prueba con otro término o quita algunos filtros.</p>
          </div>
          <Button size="sm" onClick={clearFilters}>
            Limpiar filtros
          </Button>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredFoods.map((food) => {
            const group = groupsMap.get(food.groupId);
            if (!group) return null;
            return (
              <FoodCard
                key={food.id}
                food={food}
                group={group}
                subgroup={food.subgroupId ? subgroupsMap.get(food.subgroupId) : null}
              />
            );
          })}
        </div>
      )}

      <FoodCalculatorModal
        open={isCalculatorOpen}
        onClose={() => setIsCalculatorOpen(false)}
        onCreate={(food, groupName) => {
          setFoodsList((prev) => [food, ...prev]);
          setIsCalculatorOpen(false);
          toast(`Alimento "${food.name}" agregado a "${groupName}"`, 4000);
        }}
      />
    </div>
  );
}
