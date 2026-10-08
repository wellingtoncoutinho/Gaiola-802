/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Especificações técnicas oficiais:
 * Aparelho: Lavadora Brastemp 12kg Modelo BWK12 (127V / 110V)
 * Eficiência Energética: Selo Procel A (INMETRO)
 * Consumo Padrão Homologado INMETRO: 0,372 kWh por ciclo (água fria)
 * Potência nominal: ~550W a 580W
 *
 * Concessionária: Light S.A. — Copacabana, Rio de Janeiro
 * Tarifa Residencial Convencional (Grupo B1):
 * - Base homologada ANEEL: R$ 0,881 / kWh (sem impostos)
 * - Tarifa efetiva com tributos (ICMS 18-20%, PIS/COFINS, COSIP): ~R$ 0,98 / kWh (Bandeira Verde)
 */

export interface TariffFlag {
  id: string;
  name: string;
  addition: number; // R$ adicional por kWh
  colorHex: string;
}

export const TARIFF_FLAGS: TariffFlag[] = [
  { id: 'verde', name: 'Bandeira Verde', addition: 0.0, colorHex: '#10B981' },
  { id: 'amarela', name: 'Bandeira Amarela (+R$ 0,019/kWh)', addition: 0.019, colorHex: '#F59E0B' },
  { id: 'vermelha1', name: 'Vermelha Patamar 1 (+R$ 0,045/kWh)', addition: 0.045, colorHex: '#EF4444' },
  { id: 'vermelha2', name: 'Vermelha Patamar 2 (+R$ 0,079/kWh)', addition: 0.079, colorHex: '#DC2626' },
];

export const BWK12_CYCLE_KWH: Record<string, number> = {
  dia_a_dia: 0.372, // Padrão oficial INMETRO
  leve: 0.28,
  pesada: 0.46,
  cama_edredom: 0.54,
  pano_chao: 0.22,
  limpeza_maquina: 0.32,
};

export const DEFAULT_BASE_TARIFF_KWH = 0.98; // R$ 0,98/kWh (Light RJ Copacabana com impostos)
export const INMETRO_STANDARD_KWH = 0.372;

export function getReservationKwh(loadTypeId: string): number {
  return BWK12_CYCLE_KWH[loadTypeId] ?? INMETRO_STANDARD_KWH;
}
