import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { Role } from '../../database/schemas/enums';

export class LoginDto {
  @ApiProperty({ example: '9876543210', description: 'Phone number or email address' })
  @IsString()
  @IsNotEmpty()
  identifier: string;

  @ApiProperty({ example: 'Farmer@123', description: 'Account password' })
  @IsString()
  @IsNotEmpty()
  password: string;

  @ApiPropertyOptional({
    enum: Role,
    example: Role.FARMER,
    description: 'Optional selected role on login form to verify account match',
  })
  @IsEnum(Role)
  @IsOptional()
  role?: Role;
}
