import { Test, TestingModule } from '@nestjs/testing';
import { SanctionService } from './sanction.service';

describe('SanctionService', () => {
  let service: SanctionService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [SanctionService],
    }).compile();

    service = module.get<SanctionService>(SanctionService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
