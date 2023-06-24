import { Test, TestingModule } from '@nestjs/testing';
import { ExposedService } from './exposed.service';

describe('ExposedService', () => {
  let service: ExposedService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [ExposedService],
    }).compile();

    service = module.get<ExposedService>(ExposedService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
