import { IsString, IsNotEmpty } from 'class-validator';

export class CreateTrackerDto {
  @IsString()
  @IsNotEmpty()
  name: string;
}
