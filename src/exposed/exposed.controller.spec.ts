import { Test, TestingModule } from '@nestjs/testing';
import { ExposedController } from './exposed.controller';
import { ExposedService } from './exposed.service';

describe('ExposedController', () => {
  let controller: ExposedController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ExposedController],
      providers: [ExposedService],
    }).compile();

    controller = module.get<ExposedController>(ExposedController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
