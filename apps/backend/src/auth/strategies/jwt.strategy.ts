import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User, UserDocument } from '../../database/schemas';
import { computeProfileCompletion } from '../../users/users.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: process.env.JWT_SECRET || 'vanijya_super_secret_jwt_key_sih2024',
    });
  }

  async validate(payload: { sub: string; role: string }) {
    const user = (await this.userModel.findById(payload.sub).lean()) as any;
    if (!user) {
      throw new UnauthorizedException('User not found or session expired');
    }

    const { password, passwordHash, ...safeUser } = user;
    const completion = computeProfileCompletion(user);
    return {
      id: user._id || user.id,
      ...safeUser,
      ...completion,
    };
  }
}
