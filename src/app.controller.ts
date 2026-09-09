import { HttpService } from '@nestjs/axios';
import { Controller, Get, Param } from '@nestjs/common';
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

    // === Target-resolution scenarios (8-12), appended 8/18 ==================
    // Structurally P_10: class-property path constants reached through
    // `this.X` and called via an injected HttpService whose baseURL is
    // DI-wired from the environment (see app.module.ts). P_10 contributes 542
    // of the 633 records in the 8/17 mimic corpus and reaches nearly all of
    // them this way, which makes this the highest-mass shape in the landscape.
    //
    // Declared at the BOTTOM of the class on purpose — class members may be
    // declared in any order, and putting them here keeps scenarios 1-7 on
    // their documented decorator lines.

    // Relative, no leading slash — exactly how P_10 spells these.
    private readonly GET_ME = 'internal/user/get/me';
    // A format string whose holes are NAMED, and already close to the
    // inventory's own param syntax (`{nodeId}`) — the correlation join key.
    private readonly NODE_PERMISSION = 'internal/node/%(nodeId)s/permission';
    // An absolute base held on the instance — the P_64 shape, and the modal
    // OSS one (7/12 census repos store a full base URL as a class field).
    private readonly baseUrl = 'https://api.example.com';

    // 8. Class property, relative path — the single highest-mass real shape.
    //    Resolves to a path with no scheme, so it needs BOTH the evaluator
    //    and the relaxed emission gate to surface (build steps 1+2 jointly).
    @Get('class-prop-relative')
    classPropRelative() {
        return this.http.get(this.GET_ME);
    }

    // 9. Class property base + template — resolves COMPLETE and absolute, so
    //    this is the one new scenario that should flip under step 2 alone.
    //    Uses HttpService rather than global `fetch`: this app's tsconfig has
    //    lib ["ES2022"] with no "DOM", so global fetch carries no type here
    //    and collapses to a local symbol — MEASURED 8/18, first run of this
    //    scenario returned outbound=[]. Detection of the builtin is therefore
    //    tsconfig-dependent; learning-demo (lib includes "DOM") is where the
    //    fetch+template shape is covered. The shape under test here is the
    //    class-property base, which is client-independent.
    @Get('class-prop-base')
    classPropBase() {
        return this.http.get(`${this.baseUrl}/v4/launches`);
    }

    // 10. Formatter-wrapped class property — the evaluator must unwrap
    //     `sprintf(fmt, …)` and evaluate its FIRST argument, leaving the
    //     %(nodeId)s hole intact rather than treating the call as opaque.
    @Get('class-prop-sprintf/:nodeId')
    classPropSprintf(@Param('nodeId') nodeId: string) {
        return this.http.get(sprintf(this.NODE_PERMISSION, { nodeId }));
    }

    // 11. DI-injected base: app.module.ts wires baseURL from process.env via
    //     registerAsync, so the HOST terminates at an env-var NAME and no
    //     amount of cross-file work yields a value — while the PATH here is
    //     still same-file resolvable. The host/path split argument, in one
    //     endpoint.
    @Get('di-base')
    diBase() {
        return this.http.get('internal/space/list');
    }

    // 12. No target exists: registering an interceptor is client CONFIG, not
    //     a request. ~46% of the mimic corpus is this category (P_10's two
    //     hottest "call sites" are interceptor registrations), so it needs a
    //     label, not a resolver.
    @Get('interceptor-setup')
    interceptorSetup() {
        this.http.axiosRef.interceptors.request.use((config) => config);
        return { registered: true };
    }
}

// Local formatter rather than the npm `sprintf-js` that P_10 imports: the
// unwrap rule keys on the CALLEE NAME, so the AST exercise is identical, while
// a declared-but-uninstalled dependency would risk the very index this
// baseline depends on (the indexer installs only pattern-matched packages).
// P_10 itself remains the real-world witness for the npm form.
function sprintf(fmt: string, args: Record<string, string>) {
    return fmt.replace(/%\((\w+)\)s/g, (_m, key: string) => args[key] ?? '');
}
