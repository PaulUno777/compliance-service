import { Test, TestingModule } from '@nestjs/testing';
import { Sanctioned } from './sanctioned';

describe('Sanctioned', () => {
  let provider: Sanctioned;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [Sanctioned],
    }).compile();

    provider = module.get<Sanctioned>(Sanctioned);
  });

  it('should be defined', () => {
    expect(provider).toBeDefined();
  });
});
