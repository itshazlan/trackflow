import { IsNotEmpty, IsString } from 'class-validator';

export class ConfirmDeleteDto {
  @IsString()
  @IsNotEmpty()
  confirmKey: string;
}
