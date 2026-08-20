import { describe, it, expect } from 'vitest';
import { MesinRouting } from './index';

// Mengunci perilaku tiap strategi routing agar tak berubah diam-diam: auto→prioritas,
// fast→kecepatan, smart→kualitas, cheap→biaya termurah, manual→model persis. Fixture
// sengaja dibuat supaya tiap strategi memilih model yang berbeda, jadi benar teruji.
describe('MesinRouting', () => {
  const providers: any[] = [
    { id: 'p1', nama: 'OpenAI', jenis: 'openai' },
    { id: 'p2', nama: 'Anthropic', jenis: 'anthropic' }
  ];

  const models: any[] = [
    { id: 'm1', providerId: 'p1', namaModel: 'gpt-4o', prioritas: 10, skorKecepatan: 5, skorKualitas: 10, biayaInput: 10 },
    { id: 'm2', providerId: 'p1', namaModel: 'gpt-3.5', prioritas: 5, skorKecepatan: 10, skorKualitas: 5, biayaInput: 1 },
    { id: 'm3', providerId: 'p2', namaModel: 'claude-3', prioritas: 8, skorKecepatan: 7, skorKualitas: 9, biayaInput: 8 }
  ];

  it('routes auto to highest priority', () => {
    const engine = new MesinRouting(models, providers);
    const result = engine.selectModel('auto');
    expect(result[0].model.namaModel).toBe('gpt-4o');
    expect(result[1].model.namaModel).toBe('claude-3');
    expect(result[2].model.namaModel).toBe('gpt-3.5');
  });

  it('routes fast to highest speed', () => {
    const engine = new MesinRouting(models, providers);
    const result = engine.selectModel('fast');
    expect(result[0].model.namaModel).toBe('gpt-3.5');
  });

  it('routes smart to highest quality', () => {
    const engine = new MesinRouting(models, providers);
    const result = engine.selectModel('smart');
    expect(result[0].model.namaModel).toBe('gpt-4o');
  });

  it('routes cheap to lowest cost', () => {
    const engine = new MesinRouting(models, providers);
    const result = engine.selectModel('cheap');
    expect(result[0].model.namaModel).toBe('gpt-3.5');
  });

  it('routes manual exact model', () => {
    const engine = new MesinRouting(models, providers);
    const result = engine.selectModel('claude-3');
    expect(result[0].model.namaModel).toBe('claude-3');
    expect(result.length).toBe(1);
  });
});
