import {inject} from 'aurelia-dependency-injection';
import {Authentication} from './authentication';
import {BaseConfig} from './baseConfig';
import {OAuth1} from './oAuth1';
import {OAuth2} from './oAuth2';
import {authUtils} from './authUtils';

@inject(Authentication, OAuth1, OAuth2, BaseConfig)
export class AuthService {
  constructor(authentication, oAuth1, oAuth2, config) {
    this.authentication = authentication;
    this.oAuth1         = oAuth1;
    this.oAuth2         = oAuth2;
    this.config         = config.current;
    this.client         = this.config.client;
    this.isRefreshing   = false;
  }

  getMe(criteria) {
    if (typeof criteria === 'string' || typeof criteria === 'number') {
      criteria = {id: criteria};
    }
    return this.client.find(this.authentication.getProfileUrl(), criteria);
  }

  updateMe(body, criteria) {
    if (typeof criteria === 'string' || typeof criteria === 'number') {
      criteria = { id: criteria };
    }
    return this.client.update(this.authentication.getProfileUrl(), criteria, body);
  }

  getCurrentToken() {
    return this.authentication.getToken();
  }

  getRefreshToken() {
    return this.authentication.getRefreshToken();
  }

  isAuthenticated() {
    let isExpired = this.authentication.isTokenExpired();
    if (isExpired && this.config.autoUpdateToken) {
      if (this.isRefreshing) {
        return true;
      }
      this.updateToken();
    }
    return this.authentication.isAuthenticated();
  }

  isTokenExpired() {
    return this.authentication.isTokenExpired();
  }

  getTokenPayload() {
    return this.authentication.getPayload();
  }

  signup(displayName, email, password) {
    let signupUrl = this.authentication.getSignupUrl();
    let content;

    if (typeof arguments[0] === 'object') {
      content = arguments[0];
    } else {
      content = {
        'displayName': displayName,
        'email': email,
        'password': password
      };
    }
    return this.client.post(signupUrl, content)
      .then(response => {
        if (this.config.loginOnSignup) {
          this.authentication.setTokenFromResponse(response);
        } else if (this.config.signupRedirect) {
          window.location.href = this.config.signupRedirect;
        }

        return response;
      });
  }

  login(email, password) {
    let content  = {};

    if (typeof arguments[1] !== 'string') {
      content = arguments[0];
    } else {
      content = {email: email, password: password};
      if (this.config.clientId) {
        content.client_id = this.config.clientId;
      }
    }

    return this.client.post(this.authentication.getLoginUrl(), content)
      .then(response => {
        this.authentication.setTokenFromResponse(response);
        if (this.config.useRefreshToken) {
          this.authentication.setRefreshTokenFromResponse(response);
        }

        return response;
      });
  }

  logout(redirectUri) {
    return this.authentication.logout(redirectUri);
  }

  updateToken() {
    this.isRefreshing = true;
    let refreshToken  = this.authentication.getRefreshToken();
    let content       = {};

    if (refreshToken) {
      content = {grant_type: 'refresh_token', refresh_token: refreshToken};
      if (this.config.clientId) {
        content.client_id = this.config.clientId;
      }

      return this.client.post(this.authentication.getLoginUrl(), content)
          .then(response => {
            this.authentication.setRefreshToken(response);
            this.authentication.setToken(response);
            this.isRefreshing = false;

            return response;
          }).catch((err) => {
            this.authentication.removeToken();
            this.authentication.removeRefreshToken();
            this.isRefreshing = false;

            throw err;
          });
    }
  }

  authenticate(name, redirect, userData) {
    let provider = this.oAuth2;
    if (this.config.providers[name].type === '1.0') {
      provider = this.oAuth1;
    }

    return provider.open(this.config.providers[name], userData || {})
      .then(response => {
        this.authentication.setTokenFromResponse(response, redirect);
        return response;
      });
  }

  unlink(provider) {
    let unlinkUrl = this.config.baseUrl ? authUtils.joinUrl(this.config.baseUrl, this.config.unlinkUrl) : this.config.unlinkUrl;

    if (this.config.unlinkMethod === 'get') {
      return this.client.find(unlinkUrl + provider);
    } else if (this.config.unlinkMethod === 'post') {
      return this.client.post(unlinkUrl, provider);
    }
  }
}
