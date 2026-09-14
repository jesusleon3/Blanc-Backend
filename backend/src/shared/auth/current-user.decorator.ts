import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { ClaimsUsuario } from './rol';

export const CurrentUser = createParamDecorator((_data: unknown, ctx: ExecutionContext): ClaimsUsuario => {
  const request = ctx.switchToHttp().getRequest();
  return request['usuario'];
});
