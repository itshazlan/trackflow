import { 
  Controller, 
  Get, 
  Query, 
  Res, 
  UseGuards, 
  BadRequestException 
} from '@nestjs/common';
import type { Response } from 'express';
import { ReportsService } from './reports.service';
import { AuthGuard } from '../../common/guards/auth.guard';

@Controller('reports')
@UseGuards(AuthGuard)
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get('hours')
  async getHoursReport(
    @Res() res: Response,
    @Query('format') format: string,
    @Query('projectId') projectId?: string,
    @Query('userId') userId?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string
  ) {
    if (!format || (format !== 'pdf' && format !== 'csv')) {
      throw new BadRequestException('Query parameter "format" must be either "pdf" or "csv"');
    }

    const reportData = await this.reportsService.getReportData(projectId, userId, startDate, endDate);

    if (format === 'csv') {
      const csvString = this.reportsService.generateCsv(reportData);
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename="report-hours.csv"');
      return res.status(200).send(csvString);
    } else {
      const pdfBuffer = await this.reportsService.generatePdf(reportData);
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', 'attachment; filename="report-hours.pdf"');
      return res.status(200).send(pdfBuffer);
    }
  }
}
