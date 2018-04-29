l = console.log;

Vue.component('datepicker-range', {
    props : ['from', 'to', 'active'],
    computed : {
        range() {
            return _.range(this.from, this.to + 1)
        }
    },
    template : `
        <div class="rangeHolder">
            <div class="day" v-for="i in range" :class="{active : i == active}" @click="$emit('click', i)">
                {{ i }}
            </div>
        </div>
    `
});

Vue.component('datepicker-scope', {
    data(){
        return {
            levels : ['Year', 'Month'],
            current : 'Year'
        }
    },
    template : `<div> Current level : {{ current }} </div>`
});

Vue.component('datepicker', {
    data() {
        return {
            today : moment(),
            dateSelected : moment(),
            daysInMonth : 0,

            year : 0,
            month : 0,
            day : 0,
        }
    },

    methods : {
        yearClicked(year) {
            l("Year clicked! " + year);
            this.dateSelected.year(year);
            this.year = year;
            this.$forceUpdate();
            this.emitDate();
        },
        monthClicked : function(month) {
            l("Month clicked! " + month);
            this.dateSelected.month(month-1);
            this.daysInMonth = this.dateSelected.daysInMonth();
            this.month = month;
            this.$forceUpdate();
            this.emitDate();
        },
        dayClicked(day){
            l("Day clicked! " + day);
            this.dateSelected.date(day);
            this.day = day;
            this.$forceUpdate();
            this.emitDate();
        },

        emitDate(){
            this.$emit('date-selected', this.dateSelected);
        }
    },

    mounted : function(){

        this.daysInMonth = moment().daysInMonth();
        this.year = this.today.year();
        this.month = this.today.month()+1;
        this.day = this.today.date();

    },

    template : `
        <div>
            <datepicker-range class="orange" :from=2000 :to=2020 :active="year"  v-on:click="yearClicked"  ></datepicker-range>
            <datepicker-range class="blue"   :from=1 :to=12      :active="month" v-on:click="monthClicked" ></datepicker-range>
            <datepicker-range class="orange" :from=1 :to=31      :active="day"   v-on:click="dayClicked"   ></datepicker-range>
        </div>
    `
});