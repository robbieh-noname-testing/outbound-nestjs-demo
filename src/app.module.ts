import { HttpModule } from '@nestjs/axios';
import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';

// Scenario 11's other half (8/18): the base URL is DI-wired from the
// environment rather than written at any call site — P_10's exact chain
// (`HttpModule.registerAsync` -> config factory -> `process.env`). Static
// resolution of the HOST terminates at the env-var NAME here by design, while
// the per-call PATHs stay same-file resolvable. Registering with a factory
// leaves scenarios 1-7 behaviourally unchanged; only the base differs.
@Module({
    imports: [
        HttpModule.registerAsync({
            useFactory: () => ({ baseURL: process.env.BACKEND_BASE_URL }),
        }),
    ],
    controllers: [AppController],
    providers: [AppService],
})
export class AppModule {}
