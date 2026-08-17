import { HttpService } from '@nestjs/axios';
import { Controller, Get } from '@nestjs/common';
import axios from 'axios';
import { AppService } from './app.service';

const UPSTREAM = 'https://api.example.com';

// Stage 1 of the NestJS spike: plain axios only, to isolate the traversal
// question (does the NestJS traversal populate the symbol graph the way
// Express does?) from the HttpService registry question (stage 2).
@Controller()
export class AppController {
    constructor(
        private readonly appService: AppService,
        private readonly http: HttpService,
    ) {}

    // 1. Negative control — no outbound call.
    @Get('health')
    health() {
        return { status: 'ok' };
    }

    // 2. axios directly in the handler, literal URL.
    @Get('quote')
    async quote() {
        const response = await axios.get('https://api.example.com/quote');
        return response.data;
    }

    // 3. Outbound call in a private method of the same class — the closure
    //    must cross the `this.fetchDirect()` edge.
    @Get('via-method')
    async viaMethod() {
        return this.fetchDirect();
    }

    private async fetchDirect() {
        const response = await axios.post(`${UPSTREAM}/direct`, {});
        return response.data;
    }

    // 4. Outbound call in an injected provider — the modal NestJS shape. At
    //    the symbol level this is just a typed method call; the question is
    //    whether the graph carries the controller -> service edge.
    @Get('via-service')
    async viaService() {
        return this.appService.fetchUpstream();
    }

    // 5. HttpService — the NestJS-idiomatic client (stage 2). Returning the
    //    Observable directly is the canonical Nest shape (auto-subscribed);
    //    the call site is what the @nestjs/axios registry row must anchor.
    @Get('http-service')
    httpService() {
        return this.http.get('https://api.example.com/nest');
    }

    // 6. The axiosRef escape hatch — HttpService exposes the underlying
    //    AxiosInstance. Measured (8/10): the indexer resolves the GETTER
    //    (`HttpService#<get>axiosRef().`, @nestjs/axios) but emits nothing
    //    for the trailing `.get` — so detection attributes this call via the
    //    @nestjs/axios row at the getter occurrence, not the axios row.
    @Get('axios-ref')
    async axiosRef() {
        const response = await this.http.axiosRef.get('https://api.example.com/ref');
        return response.data;
    }

    // 7. HttpService in the SERVICE, wrapped in firstValueFrom, using post —
    //    converts the three mechanism-inferred cases (rxjs wrapper, other
    //    verb, provider placement) to measured in one path.
    @Get('via-service-http')
    async viaServiceHttp() {
        return this.appService.pushDownstream();
    }
}
