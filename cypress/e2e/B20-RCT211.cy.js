import "cypress-localstorage-commands";
import data from "../fixtures/RCT211.json"; // import data from fixtures
const getAuth = (win) => win.store.getState().AuthReducer;
const getWatches = (win) => win.store.getState().AppReducer;

let newData = data.filter((ele) => !ele.submission_link.includes("github")); // filter only deployed link
c2Test();

function c2Test() {
  newData.forEach(({ username, submission_link: url, name }) => {
    describe("c2", () => {
      let acc_score = 0;
      beforeEach(() => {
        if (url.charAt(url.length - 1) !== "/") {
          url = url + "/";
        }
        cy.visit(url);
        cy.window().its("store").should("exist");
      });

      it("Check Initial Redux Store Structure", () => {
        cy.window()
          .then(getWatches)
          .should("deep.equal", {
            watches: [],
            isLoading: false,
            isError: false,
          })
          .then(() => {
            acc_score += 0.25;
          });
        cy.window()
          .then(getAuth)
          .should("deep.equal", {
            isLoading: false,
            isError: false,
            isAuth: false,
            token: "",
          })
          .then(() => {
            acc_score += 0.25;
          });
      });

      it("Check if proper GET request and response is made", () => {
        cy.url().should("eq", url);
        cy.server();
        cy.route("GET", "/watches").as("watches");
        cy.wait("@watches").should((xhr) => {
          expect(xhr.status, "successful GET").to.equal(200);
          expect(xhr.url, "get url").to.match(/\/watches$/);
        });
        cy.get("@watches").its("response.body").should("have.length", 15);
        cy.then(() => (acc_score += 1));
      });

      it("Check if the number of cards displayed is 15", () => {
        cy.intercept("GET", "**/watches").as("watches");
        cy.wait("@watches");
        cy.get("[data-testid^=watch-card-wrapper]").should("have.length", 15);
        cy.then(() => (acc_score += 1));
      });

      it("Check if the Card component contains all the required information", () => {
        cy.request("GET", "http://localhost:8080/watches").then(({ body }) => {
          body.forEach((singleWatch) => {
            cy.get(
              `[data-testid='watch-card-wrapper-${singleWatch.id}']`
            ).within(() => {
              cy.get("[data-testid=watch-name]").contains(singleWatch.name);
              cy.get("[data-testid=watch-card-image]")
                .should("have.attr", "src")
                .should("include", singleWatch.image);
            });
          });
        });
        cy.then(() => (acc_score += 1));
      });

      it("Check if the url is redirected to login page before visiting /watch/1, without authentication", () => {
        cy.window().then(getAuth).its("isAuth").should("equal", false);
        cy.window().then(getAuth).its("token").should("equal", "");

        cy.visit(`${url}watches/1`).then(() => {
          cy.location("pathname").should("match", /\/login$/);
        });

        cy.intercept("POST", "**/api/login").as("login");

        cy.get("[data-testid=login-email]").clear().type("eve.holt@reqres.in");
        cy.get("[data-testid=login-password]").clear().type("cityslicka");
        cy.get("[data-testid=login-submit]").click();

        cy.wait(["@login"]);

        cy.url().should("eq", `${url}watches/1`);

        cy.then(() => (acc_score += 2));
      });

      it("Check if Filters are working with updating single data", () => {
        cy.get('[type="checkbox"]')
          .check("Analog")
          .then(() => {
            cy.url().should("eq", `${url}?category=Analog`);
            cy.get("[data-testid^=watch-card-wrapper]").should(
              "have.length",
              5
            );
          });

        cy.then(() => (acc_score += 1));
      });

      it("Check if Filters are working with updating multiple data", () => {
        cy.get('[type="checkbox"]')
          .check(["Analog", "Digital", "Chronograph"])
          .then(() => {
            cy.url().should(
              "eq",
              `${url}?category=Analog&category=Digital&category=Chronograph`
            );
            cy.get("[data-testid^=watch-card-wrapper]").should(
              "have.length",
              15
            );

            cy.get('[type="checkbox"]')
              .uncheck(["Analog", "Chronograph"])
              .then(() => {
                cy.url().should("eq", `${url}?category=Digital`);
                cy.get("[data-testid^=watch-card-wrapper]").should(
                  "have.length",
                  5
                );
              });
          });
        cy.then(() => (acc_score += 1));
      });

      it(
        "Check if the Filter search params are working with initial checks in URL",
        { retries: 1 },
        () => {
          cy.visit(`${url}?category=Analog&category=Digital`).then(() => {
            cy.get("[data-testid=filter-category]")
              .find("[value='Analog']")
              .should("be.checked");
            cy.get("[data-testid=filter-category]")
              .find("[value='Digital']")
              .should("be.checked");
            cy.get("[data-testid^=watch-card-wrapper]").should(
              "have.length",
              10
            );
          });
          cy.then(() => {
            acc_score += 0.5;
          });
        }
      );

      it(`${url} Score`, async () => {
        console.log(`${url} Final Score:`, acc_score);

        let myHeaders = new Headers();
        myHeaders.append("Content-Type", "application/json");

        let payload = JSON.stringify({
          ...username,
          score: url.trim().length !== 0 ? acc_score : 0,
          time: new Date(),
        });

        let requestOptions = {
          method: "POST",
          headers: myHeaders,
          body: payload,
          redirect: "follow",
        };

        await fetch("http://localhost:5000/scores/", requestOptions)
          .then((r) => r.text())
          .then((r) => console.log(r))
          .catch((e) => console.log("Error", e));
        cy.wait(2000);
      });

      it(`${username} generate score`, () => {
        if (!url || url === "/") {
          acc_score = 0;
        } else if (acc_score === 0) {
          acc_score = 1;
        } else if (acc_score === 10) {
          acc_score = 9;
        }
        let newscore = Math.ceil(acc_score);
        console.log("final score:", acc_score);
        // console.log("final score:", Math.ceil(acc_score));1
        let result = {
          username,
          name,
          submission_link: url,
          marks: newscore,
        };
        result = JSON.stringify(result);
        cy.writeFile(
          "b20-E2-results/rct211-results.json",
          `\n${result},`,
          { flag: "a+" },
          (err) => {
            if (err) {
              console.error(err);
            }
          }
        );
      });
    });
  });
}
