import { HttpService } from '@nestjs/axios';
import { Injectable } from '@nestjs/common';
import axios from 'axios';
import { firstValueFrom } from 'rxjs';

@Injectable()
export class AppService {
    constructor(private readonly http: HttpService) {}

    // The provider-side outbound call for scenario 4: reached only through the
    // controller's injected `this.appService` — the cross-class closure edge.
    async fetchUpstream() {
        const response = await axios.get('https://api.example.com/from-service');
        return response.data;
    }

    // Scenario 7's provider half: HttpService injected into a SERVICE (not the
    // controller), a different verb (post), and the rxjs consumption wrapper
    // (firstValueFrom — declared but unpatterned, so it resolves local) — the
    // three mechanism-inferred cases measured in one path.
    async pushDownstream() {
        const response = await firstValueFrom(
            this.http.post('https://api.example.com/push', {}),
        );
        return response.data;
    }
}
