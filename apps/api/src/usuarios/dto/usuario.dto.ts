import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import { RolUsuario } from '../../generated/prisma/client.js';
import {
  aBooleano,
  ConsultaPaginadaDto,
  recortar,
} from '../../comun/paginacion.js';

const MENSAJE_ROL = `rol debe ser uno de: ${Object.values(RolUsuario).join(', ')}`;

/** Contraseña: mínimo 8 caracteres; bcrypt solo toma en cuenta los primeros 72 bytes. */
class PasswordDto {
  @ApiProperty({ example: '<contraseña-nueva>', minLength: 8, maxLength: 72 })
  @IsString()
  @MinLength(8, { message: 'password debe tener al menos 8 caracteres' })
  @MaxLength(72, { message: 'password no puede tener más de 72 caracteres' })
  password: string;
}

export class CrearUsuarioDto extends PasswordDto {
  @ApiProperty({ example: 'Coordinadora de turno', maxLength: 100 })
  @Transform(recortar)
  @IsString()
  @IsNotEmpty({ message: 'nombre no debe estar vacío' })
  @MaxLength(100)
  nombre: string;

  @ApiProperty({ example: 'turno@bestline.local', maxLength: 150 })
  // Igual que en el login: sin espacios y en minúsculas.
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  @IsEmail({}, { message: 'email debe ser un correo válido' })
  @MaxLength(150)
  email: string;

  @ApiProperty({ enum: RolUsuario, example: RolUsuario.COORDINADOR })
  @IsEnum(RolUsuario, { message: MENSAJE_ROL })
  rol: RolUsuario;
}

/** En la edición solo se cambian el nombre y el rol (el correo identifica al usuario). */
export class ActualizarUsuarioDto {
  @ApiPropertyOptional({ example: 'Coordinadora de turno', maxLength: 100 })
  @IsOptional()
  @Transform(recortar)
  @IsString()
  @IsNotEmpty({ message: 'nombre no debe estar vacío' })
  @MaxLength(100)
  nombre?: string;

  @ApiPropertyOptional({ enum: RolUsuario, example: RolUsuario.SUPERVISOR })
  @IsOptional()
  @IsEnum(RolUsuario, { message: MENSAJE_ROL })
  rol?: RolUsuario;
}

export class CambiarPasswordDto extends PasswordDto {}

export class ConsultaUsuariosDto extends ConsultaPaginadaDto {
  @ApiPropertyOptional({ enum: RolUsuario, description: 'Filtrar por rol' })
  @IsOptional()
  @IsEnum(RolUsuario, { message: MENSAJE_ROL })
  rol?: RolUsuario;

  @ApiPropertyOptional({
    description: 'Filtrar activos o inactivos',
    example: true,
  })
  @IsOptional()
  @Transform(aBooleano)
  @IsBoolean({ message: 'activo debe ser true o false' })
  activo?: boolean;
}
