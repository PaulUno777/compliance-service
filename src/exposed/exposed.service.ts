import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class ExposedService {
  private readonly logger = new Logger(ExposedService.name);

  constructor(private prisma: PrismaService, private config: ConfigService) {}

  async findAll(page?: number, limit?: number, orderBy?: string): Promise<any> {
    
    this.logger.log('finding all Politically Exposed Persons ordered and paginated...');

    //parameters controls
    if (page) {
      if (typeof page !== 'number')
        throw new BadRequestException('page must be a number');
    }

    if (limit) {
      if (typeof limit != 'number')
        throw new BadRequestException('limit must be a number');
    }

    if (orderBy) {
      const orders = ['asc', 'desc', 'ASC', 'DESC', 'Asc', 'Desc'];
      if (!orders.includes(orderBy))
        throw new BadRequestException(
          `possibles values of orderBy are ${orders}`,
        );
    }

    //Elements per page
    const PER_PAGE = limit || 20;
    let count = await this.prisma.politicallyExposed.count();

    const currentPage: number = Math.max(Number(page) || 1, 1);
    const pageNumber: number = currentPage - 1;

    let ordener;
    if (orderBy) {
      const order = orderBy.toLowerCase();
      if (order == 'desc') ordener = { defaultName: 'desc' };
      if (order == 'asc') ordener = { defaultName: 'asc' };
    } else {
      {
        defaultName: 'asc';
      }
    }

    const queryOptions = {
      orderBy: ordener,
      select: { id: true, defaultName: true, type: true, positions: true },
      skip: pageNumber * PER_PAGE,
      take: PER_PAGE,
    };

    const results = await this.prisma.politicallyExposed.findMany(queryOptions);

    const lastPage = Math.ceil(count / PER_PAGE);
    let prev = null;
    let next = null;
    if (currentPage != 1) prev = currentPage - 1;
    if (currentPage != lastPage) next = currentPage + 1;

    return {
      data: results,
      meta: {
        total: count,
        lastPage: lastPage,
        currentPage: currentPage,
        perPage: PER_PAGE,
        prev: prev,
        next: next,
      },
    };
  }

  async findOne(id: string) {
    this.logger.log(`===== finding by id ====\n Id = ${id}`);

    const result = await this.prisma.politicallyExposed.findUnique({
      where: {
        id: id,
      },
    });

    this.logger.log('(success !) all is well');

    return {
      data: result,
    };;
  }
}
