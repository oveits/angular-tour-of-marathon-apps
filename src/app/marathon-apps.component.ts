import { Component, OnInit, OnDestroy } from '@angular/core';
import { Router } from '@angular/router';
import { ActivatedRoute, Params } from '@angular/router';
import { MarathonApp } from './marathon-app';
import { MarathonAppService } from './marathon-app.service';
import { RestItem } from './rest-item';
import { interval } from 'rxjs';
import { timer } from 'rxjs';
import { map, filter, catchError, delay } from 'rxjs/operators';
import { Subscription, Observable } from 'rxjs';

// for handleError:
import { HttpErrorResponse  } from '@angular/common/http';
import { throwError as observableThrowError } from 'rxjs';


@Component({
  selector: 'my-marathon-apps',
  templateUrl: './marathon-apps.component.html',
  styleUrls: ['./marathon-apps.component.css']
})
export class MarathonAppsComponent implements OnInit, OnDestroy {
  marathonApps: MarathonApp[];
  intervalMarathonApps$$: Observable<Observable<MarathonApp[]>>;
  selectedMarathonApp: MarathonApp;
  addingMarathonApp = false;
  error: any;
  showNgFor = false;
  exposedUrl: String = '/marathonapps';
  project: String = null;

  // for dynamic refresh interval with exponential backoff:
  msecMin = 1000;
  msecMax = 30000;
  backoffFactor = 1.5;
  private allSubscriptions: Subscription[] = new Array<Subscription>();

  // for static refresh interval (commented out in favor of the dynamic interval with exponential backoff)
  // msec: number = 5000;
  // private intervalRefreshSub: Subscription;

  counter$;
  refreshDelayed$$: Observable<Observable<MarathonApp[]>>;

  time$: Observable<Date> = interval(1000).pipe(map(val => {
    console.log(val); return new Date();
  }));

  increasingTime = 2000;
  timeIncreased$: Observable<Date> = interval(this.increasingTime)
    .pipe(map(val => {
      this.increasingTime = 2 * this.increasingTime;
      console.log(val);
      return new Date();
    }));


  constructor(private router: Router,
    private marathonAppService: MarathonAppService,
    private route: ActivatedRoute) {}

  // getMarathonApps(myProject: String = null): void {
  //   this.marathonAppService
  //     .getAll()
  //     .subscribe(
  //       marathonApps => {
  //         this.marathonApps = marathonApps as MarathonApp[];
  //         if (myProject) {
  //           this.project = myProject;
  //           this.marathonApps = this.marathonApps.filter(app => app.project === myProject)
  //         }
  //         console.log(this.marathonApps);
  //       }
  //       ,
  //       error => {
  //         console.log(error);
  //         this.error = error;
  //       }
  //     )
  // }

  getMarathonApps$(myProject: String = null): Observable<MarathonApp[] | {}> {
    return this.marathonAppService
      .getAll()
      .pipe(
        map(marathonApps => {
          const filteredMarathonApps = marathonApps.filter(app => app.project === myProject) as MarathonApp[];
          console.log(filteredMarathonApps);
          this.marathonApps = filteredMarathonApps;
          return filteredMarathonApps;
        }),
        catchError(error => this.error = error)
      )
  }

  addMarathonApp(): void {
    this.addingMarathonApp = true;
    this.selectedMarathonApp = null;
    // this.refresh(this.msecMin);
    this.refreshDelayed$$ = this.refreshDelayed$(this.msecMin, this.getMarathonApps$(this.project));
  }

  close(savedMarathonApp: MarathonApp): void {
    this.addingMarathonApp = false;
    // if (savedMarathonApp) {
    this.getMarathonApps$(this.project);
    // }
  }

  deleteMarathonApp(marathonApp: MarathonApp, event: any): void {
    event.stopPropagation();
    this.marathonAppService.delete(marathonApp).subscribe(res => {
      this.marathonApps = this.marathonApps.filter(h => h !== marathonApp);
      if (this.selectedMarathonApp === marathonApp) {
        this.selectedMarathonApp = null;
      }

      // not really needed:
      // this.refresh(this.msecMin);
    }, error => (this.error = error));
  }

  ngOnInit(): void {

    this.route.params.forEach((params: Params) => {
      if (params['project'] !== undefined) {
        this.project = params['project'];
        // this.getMarathonApps(this.project);
      } else {
        // this.getMarathonApps();
      }
    });

    // // refresh with static interval:
    //  this.intervalRefreshSub = interval(this.msec)
    //   .subscribe(res => {
    //     this.getMarathonApps(this.project);
    //   });

    // this.counter$ = interval(5000)
    // .pipe(
    //   map((x) => {
    //      console.log(x);
    //      this.getMarathonApps(this.project);
    //      return x;
    //   })
    // )

    // // works fine with intervalMarathonApps$$ | async | async in the HTML template:
    // this.intervalMarathonApps$$ = interval(5000)
    // .pipe(map((x) => {
    //      console.log(x);
    //      return this.marathonAppService.getAll()
    //       .pipe(map((marathonApps) => {
    //         this.marathonApps = marathonApps.filter(app => app.project === this.project);
    //         return this.marathonApps;
    //       }))
    //     }));

    this.refreshDelayed$$ = this.refreshDelayed$(this.msecMin, this.getMarathonApps$(this.project));


    // refresh with exponential backoff:
    // this.refresh(this.msecMin);
  }

  refreshDelayedOld(msec) {
    return timer(msec)
    .pipe(map((x) => {
      console.log('x = ' + x);
      return this.marathonAppService.getAll()
       .pipe(map((marathonApps) => {
         this.marathonApps = marathonApps.filter(app => app.project === this.project);

         console.log(`refreshing msec = ${msec}`);
         let msecNew = msec
         if ( ! this.addingMarathonApp ) {
           msecNew = msec * this.backoffFactor;
         }

         if (msecNew > this.msecMax) {
           msecNew = this.msecMax;
         }

         console.log(`msecNew = ${msecNew}`);

         this.refreshDelayed$$ = this.refreshDelayedOld(msecNew);
         return this.refreshDelayedOld(msecNew);

        //  return this.marathonApps;
       }))
     }));
  }

  refreshDelayed$(msec, myFunction) {
    return timer(msec)
      .pipe(map((x) => {
        console.log('x = ' + x);
        return myFunction
          .pipe(map(() => {
            console.log(`refreshing msec = ${msec}`);
            let msecNew = msec
            if ( ! this.addingMarathonApp ) {
              msecNew = msec * this.backoffFactor;
            }

            if (msecNew > this.msecMax) {
              msecNew = this.msecMax;
            }

            console.log(`msecNew = ${msecNew}`);

            this.refreshDelayed$$ = this.refreshDelayed$(msecNew, myFunction);
            // not needed?
            return this.refreshDelayed$(msecNew, myFunction);
          }))
      }));
  }

  // // refresh with exponential backoff (tested successfully):
  // refresh(msec): void {
  //   // cancel old refresh timers:
  //   this.allSubscriptions.map(sub => sub.unsubscribe());
  //   // garbage collection: only active subscriptions are kept:
  //   this.allSubscriptions = this.allSubscriptions.filter((sub) => {sub.closed === false});

  //   this.allSubscriptions.push(
  //     timer(msec)
  //       .subscribe(res => {
  //         this.getMarathonApps(this.project);
  //         console.log(`refreshing msec = ${msec}`);

  //         let msecNew = msec
  //         if ( ! this.addingMarathonApp ) {
  //           msecNew = msec * this.backoffFactor;
  //         }

  //         if (msecNew > this.msecMax) {
  //           msecNew = this.msecMax;
  //         }

  //         console.log(`msecNew = ${msecNew}`);

  //         this.refresh(msecNew);
  //       })
  //   );
  // }


  // not sure, whether this handleError function makes sense. Errors are caught in getAl() already...
  protected handleError(error: any) {
    console.log(error);
    this.error = error;
    return error;
  }


  ngOnDestroy() {
    // // for refresh with static interval:
    // if (typeof(this.intervalRefreshSub) !== undefined) {
    //   this.intervalRefreshSub.unsubscribe();
    // }

    // for refresh with exponential backoff:
    // cancel old refresh timers:
    this.allSubscriptions.map(sub => sub.unsubscribe());
    // garbage collection: only active subscriptions are kept:
    this.allSubscriptions = this.allSubscriptions.filter((sub) => sub.closed === false);
  }

  onSelect(marathonApp: MarathonApp): void {
    this.selectedMarathonApp = marathonApp;
    this.addingMarathonApp = false;
    this.router.navigate([this.exposedUrl, this.selectedMarathonApp.id]);
  }

  gotoDetail(): void {
    this.router.navigate([this.exposedUrl, this.selectedMarathonApp.id]);
  }
}
