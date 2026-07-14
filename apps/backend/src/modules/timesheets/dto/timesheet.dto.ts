import {
  IsString,
  IsNotEmpty,
  IsDateString,
  IsUUID,
  IsOptional,
  IsIn,
} from 'class-validator';

export class CreateTimesheetDto {
  @IsUUID()
  @IsNotEmpty()
  projectId: string;

  @IsDateString()
  @IsNotEmpty()
  periodStart: string;

  @IsDateString()
  @IsNotEmpty()
  periodEnd: string;
}

export class SubmitTimesheetDto {
  // No body required — action is "submit"
}

export class ApproveTimesheetDto {
  @IsString()
  @IsNotEmpty()
  @IsIn(['approved', 'rejected'])
  decision: 'approved' | 'rejected';

  @IsString()
  @IsOptional()
  note?: string;
}
