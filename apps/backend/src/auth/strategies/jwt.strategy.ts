import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { UserRepository } from '../../repositories/user.repository';
import { computeProfileCompletion } from '../../users/users.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private readonly userRepository: UserRepository) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: process.env.JWT_SECRET || 'vanijya_super_secret_jwt_key_sih2024',
    });
  }

  async validate(payload: { sub: string; role: string }) {
    const user = await this.userRepository.findById(payload.sub);
    if (!user) {
      throw new UnauthorizedException('User not found or session expired');
    }

    const { passwordHash, ...safeUser } = user;
    const completion = computeProfileCompletion(user);
    return {
      id: user._id,
      ...safeUser,
      ...completion,
    };
  }
}
