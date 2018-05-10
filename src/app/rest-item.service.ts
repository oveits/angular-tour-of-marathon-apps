import { HttpClient, HttpErrorResponse, HttpInterceptor  } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable, throwError as observableThrowError } from 'rxjs';
import { catchError, map } from 'rxjs/operators';

import { RestItem } from './rest-item';

@Injectable()
export class RestItemService {
    private restItemsUrl : string = "http://94.130.187.229/service/marathon/v2/apps";

    constructor(private http: HttpClient) {}

    // Read all REST Items
    getRestItems() {
      return this.http
        .get<RestItem[]>(this.restItemsUrl)
        .pipe(map(data => data), catchError(this.handleError));
    }

    // Read REST Item
    getRestItem(id: string): Observable<RestItem> {
      return this.getRestItems().pipe(
        map(restItems => restItems.find(restItem => restItem.id === id))
      );
    }
  
    // Save REST Item, i.e. create it, if it does not exist or update it, if it exists
    save(restItem: RestItem) {
      if (restItem.id) {
        return this.put(restItem);
      }
      return this.post(restItem);
    }
  
    // Delete REST Item
    delete(restItem: RestItem) { 
      const url = `${this.restItemsUrl}/${restItem.id}`; 

      return this.http.delete<RestItem>(url).pipe(catchError(this.handleError));;
    }
  
    // Add new REST Item
    private post(restItem: RestItem) {
      return this.http
        .post<RestItem>(this.restItemsUrl, restItem)
        .pipe(catchError(this.handleError));
    }
  
    // Update existing REST Item
    private put(restItem: RestItem) {
      const url = `${this.restItemsUrl}/${restItem.id}`;

      return this.http.put<RestItem>(url, restItem).pipe(catchError(this.handleError));
    }

    private handleError(res: HttpErrorResponse | any) {
      console.error(res.error || res.body.error);
      return observableThrowError(res.error || 'Server error');
    }
}   
