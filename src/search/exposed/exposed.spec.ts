import { Test, TestingModule } from '@nestjs/testing';
import { Exposed } from './exposed';

describe('Exposed', () => {
  let provider: Exposed;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [Exposed],
    }).compile();

    provider = module.get<Exposed>(Exposed);
  });

  it('should be defined', () => {
    expect(provider).toBeDefined();
  });
});
