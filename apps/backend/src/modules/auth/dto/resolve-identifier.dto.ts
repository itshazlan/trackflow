import { IsNotEmpty, IsString } from 'class-validator';

export class ResolveIdentifierDto {
  @IsString()
  @IsNotEmpty()
  identifier: string;
}
