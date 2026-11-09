import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsEmail, IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class LoginDto {
  @ApiProperty({ example: 'admin@bestline.local' })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  @IsEmail({}, { message: 'email debe ser un correo válido' })
  @MaxLength(150)
  email: string;

  @ApiProperty({ example: '<contraseña>' })
  @IsString()
  @IsNotEmpty({ message: 'password no debe estar vacío' })
  @MaxLength(100)
  password: string;
}
