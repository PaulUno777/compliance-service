import { Test, TestingModule } from '@nestjs/testing';
import { SanctionController } from './sanction.controller';

describe('SanctionController', () => {
  let controller: SanctionController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [SanctionController],
    }).compile();

    controller = module.get<SanctionController>(SanctionController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
